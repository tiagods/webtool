package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound"
)

// SessaoService orquestra a autenticação por cookie: valida o aceite do termo,
// cria ou reaproveita a sessão (JWT + item inicial de rascunho) e encerra a
// sessão sob solicitação.
type SessaoService struct {
	abertura  outbound.RascunhoRepository
	alteracao outbound.RascunhoRepository
	tokens    outbound.TokenService
	storage   outbound.DocumentoStorage
}

// NewSessaoService injeta os repositórios de rascunho (um por tabela), o serviço
// de token e o storage de documentos (usado só no encerramento).
func NewSessaoService(
	abertura, alteracao outbound.RascunhoRepository,
	tokens outbound.TokenService,
	storage outbound.DocumentoStorage,
) *SessaoService {
	return &SessaoService{abertura: abertura, alteracao: alteracao, tokens: tokens, storage: storage}
}

// SessaoResult descreve o desfecho de CriarOuObter. Token só precisa ser gravado
// no cookie quando Nova é true (o cookie existente continua válido caso contrário).
type SessaoResult struct {
	SessionID string
	Token     string
	Nova      bool
}

// repoDe seleciona o repositório da tabela correspondente ao formulário.
// FormAlteracao usa a tabela de alteração; qualquer outro valor cai na de abertura.
func (s *SessaoService) repoDe(formType entity.FormType) outbound.RascunhoRepository {
	if formType == entity.FormAlteracao {
		return s.alteracao
	}
	return s.abertura
}

// VerificarAceite falha com ErrAceiteAusente se o token do cookie prolink_aceite
// estiver ausente, for inválido/expirado, ou trouxer uma versão de termo antiga.
func (s *SessaoService) VerificarAceite(aceiteToken string) error {
	if aceiteToken == "" {
		return ErrAceiteAusente
	}
	versaoTermo, err := s.tokens.VerificarAceite(aceiteToken)
	if err != nil || versaoTermo != entity.TermoVersaoAtual {
		return ErrAceiteAusente
	}
	return nil
}

// CriarOuObter reaproveita o cookie prolink_session quando válido ou cria uma
// sessão nova (UUID + token). Em ambos os casos garante o item inicial de
// rascunho na tabela do formType (EnsureInicial é idempotente) — isso cobre o
// caso do usuário que trocou de formulário reusando a mesma sessão.
func (s *SessaoService) CriarOuObter(ctx context.Context, formType entity.FormType, sessaoToken string) (SessaoResult, error) {
	repo := s.repoDe(formType)

	if sessaoToken != "" {
		if sessionID, err := s.tokens.VerificarSessao(sessaoToken); err == nil {
			if err := repo.EnsureInicial(ctx, sessionID); err != nil {
				return SessaoResult{}, fmt.Errorf("garantir rascunho inicial: %w", err)
			}
			return SessaoResult{SessionID: sessionID, Token: sessaoToken, Nova: false}, nil
		}
	}

	sessionID := uuid.NewString()
	token, err := s.tokens.AssinarSessao(sessionID)
	if err != nil {
		return SessaoResult{}, fmt.Errorf("assinar token de sessão: %w", err)
	}
	if err := repo.EnsureInicial(ctx, sessionID); err != nil {
		return SessaoResult{}, fmt.Errorf("garantir rascunho inicial: %w", err)
	}
	return SessaoResult{SessionID: sessionID, Token: token, Nova: true}, nil
}

// RequireSessao valida que a sessão existe na tabela do formType e ainda não foi
// enviada. Retorna ErrSessaoInvalida (inexistente) ou ErrSessaoEnviada (submetida).
func (s *SessaoService) RequireSessao(ctx context.Context, formType entity.FormType, sessionID string) error {
	item, err := s.repoDe(formType).Get(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("buscar rascunho: %w", err)
	}
	return validarRascunhoAtivo(item)
}

// EncerrarPorToken resolve o sessionID a partir do token do cookie prolink_session
// e delega para Encerrar. Token ausente ou inválido ⇒ ErrSessaoInvalida (o
// DELETE precisa distinguir "sessão inexistente" de "sessão já enviada").
func (s *SessaoService) EncerrarPorToken(ctx context.Context, sessaoToken string) error {
	if sessaoToken == "" {
		return ErrSessaoInvalida
	}
	sessionID, err := s.tokens.VerificarSessao(sessaoToken)
	if err != nil {
		return ErrSessaoInvalida
	}
	return s.Encerrar(ctx, sessionID)
}

// Encerrar apaga os dados da sessão (exclusão sob solicitação, LGPD Art. 18):
// remove os objetos S3 sob a pasta da sessão e o item de rascunho. Opera sobre a
// tabela de abertura. Retorna ErrSessaoInvalida (inexistente) ou ErrSessaoEnviada
// (protocolada — exige contato direto com a empresa).
func (s *SessaoService) Encerrar(ctx context.Context, sessionID string) error {
	item, err := s.abertura.Get(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("buscar rascunho: %w", err)
	}
	if err := validarRascunhoAtivo(item); err != nil {
		return err
	}

	if err := s.storage.DeletePrefix(ctx, sessionID+"/"); err != nil {
		return fmt.Errorf("limpar documentos da sessão: %w", err)
	}
	if err := s.abertura.Delete(ctx, sessionID); err != nil {
		return fmt.Errorf("apagar rascunho: %w", err)
	}
	return nil
}

// validarRascunhoAtivo traduz o estado do item em um erro sentinela.
func validarRascunhoAtivo(item *entity.Rascunho) error {
	switch {
	case item == nil:
		return ErrSessaoInvalida
	case item.Enviado():
		return ErrSessaoEnviada
	default:
		return nil
	}
}
