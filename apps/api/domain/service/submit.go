package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"golang.org/x/sync/errgroup"

	"github.com/tiagods/webtool/apps/api/domain/entity"
	"github.com/tiagods/webtool/apps/api/domain/ports/outbound"
	"github.com/tiagods/webtool/apps/api/domain/validation"
)

// SubmitService finaliza a Ficha de Abertura (rota POST /api/submit): valida o
// formulário completo, gera o protocolo, move os documentos para a pasta do
// protocolo, publica a mensagem que o worker consome, marca a sessão como
// enviada e limpa os objetos da sessão. Espelha apps/api/app/api/submit/route.ts.
type SubmitService struct {
	repo      outbound.RascunhoRepository
	protocolo outbound.ProtocoloCounter
	publisher outbound.SubmissaoPublisher
	storage   outbound.DocumentoStorage
}

// NewSubmitService injeta os ports do submit da abertura: repositório e contador
// de protocolo da tabela de abertura, publisher da fila e storage de documentos.
func NewSubmitService(
	repo outbound.RascunhoRepository,
	protocolo outbound.ProtocoloCounter,
	publisher outbound.SubmissaoPublisher,
	storage outbound.DocumentoStorage,
) *SubmitService {
	return &SubmitService{repo: repo, protocolo: protocolo, publisher: publisher, storage: storage}
}

// Submeter valida o payload completo e, se válido, executa a finalização na
// mesma ordem do Node: copia os documentos → publica no SQS → marca enviado →
// apaga os objetos da sessão. As issues de validação são devolvidas para o
// handler responder 400 com elas no corpo; err sinaliza só falha de
// infraestrutura (→ 500) e aborta a finalização antes de qualquer efeito
// irreversível quando ocorre na cópia dos documentos.
func (s *SubmitService) Submeter(ctx context.Context, sessionID string, raw json.RawMessage) (string, []validation.Issue, error) {
	if issues := validation.ValidarAberturaForm(raw); len(issues) > 0 {
		return "", issues, nil
	}

	tipo := extrairTipoConstituicao(raw)

	item, err := s.repo.Get(ctx, sessionID)
	if err != nil {
		return "", nil, fmt.Errorf("buscar rascunho: %w", err)
	}
	documentosKeys := map[string]string{}
	if item != nil && item.DocumentosKeys != nil {
		documentosKeys = item.DocumentosKeys
	}

	protocolo, err := s.protocolo.Proximo(ctx, entity.ProtocoloPrefixAbertura)
	if err != nil {
		return "", nil, fmt.Errorf("gerar protocolo: %w", err)
	}

	if err := s.copiarDocumentos(ctx, sessionID, protocolo, documentosKeys); err != nil {
		return "", nil, err
	}

	msg := entity.SubmissaoMessage{
		SessionID: sessionID,
		Protocolo: protocolo,
		FormType:  entity.FormAbertura,
		Tipo:      tipo,
	}
	if err := s.publisher.Publish(ctx, msg); err != nil {
		return "", nil, fmt.Errorf("publicar submissão: %w", err)
	}

	// MarcarEnviado antes de o handler expirar o cookie fecha a janela de reuso
	// de um JWT de sessão ainda válido. tipo é regravado com o valor validado do
	// submit (pode ter mudado desde o último draft).
	if err := s.repo.MarcarEnviado(ctx, sessionID, protocolo, tipo); err != nil {
		return "", nil, fmt.Errorf("marcar sessão enviada: %w", err)
	}

	if err := s.storage.DeletePrefix(ctx, sessionID+"/"); err != nil {
		return "", nil, fmt.Errorf("limpar objetos da sessão: %w", err)
	}

	return protocolo, nil, nil
}

// copiarDocumentos move cada documento de "{sessionID}/documentos/" para
// "protocolos/{protocolo}/" em paralelo. A primeira falha cancela as demais
// cópias e é devolvida — o submit aborta antes de publicar ou marcar enviado.
func (s *SubmitService) copiarDocumentos(ctx context.Context, sessionID, protocolo string, keys map[string]string) error {
	if len(keys) == 0 {
		return nil
	}

	g, gctx := errgroup.WithContext(ctx)
	for _, srcKey := range keys {
		g.Go(func() error {
			destKey := destinoDocumento(srcKey, sessionID, protocolo)
			if err := s.storage.Copy(gctx, srcKey, destKey); err != nil {
				return fmt.Errorf("copiar documento %q: %w", srcKey, err)
			}
			return nil
		})
	}
	return g.Wait()
}

// destinoDocumento troca o prefixo da sessão pelo prefixo do protocolo na key,
// espelhando `sourceKey.replace(sessionPrefix, destPrefix)` do Node.
func destinoDocumento(srcKey, sessionID, protocolo string) string {
	origem := sessionID + "/documentos/"
	destino := "protocolos/" + protocolo + "/"
	return strings.Replace(srcKey, origem, destino, 1)
}
