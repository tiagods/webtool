package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
)

// Os ports que são puros spies (AceiteRepository, DocumentoStorage,
// ProtocoloCounter, SubmissaoPublisher) usam os mocks gerados em
// domain/ports/outbound/mocks (go.uber.org/mock). Os fakes à mão abaixo cobrem
// os ports que valem mais como store/emissor stateful nos testes: o repositório
// de rascunho (semeia + leitura consistente) e o serviço de token.

// fakeTokens simula o TokenService com tokens de texto simples no formato
// "aceite:<sessionID>:<versao>" e "sessao:<sessionID>". validos controla se a
// verificação aceita o token.
type fakeTokens struct {
	assinarErro error
	validos     bool
}

func newFakeTokens() *fakeTokens { return &fakeTokens{validos: true} }

func (f *fakeTokens) AssinarAceite(sessionID, versaoTermo string) (string, error) {
	if f.assinarErro != nil {
		return "", f.assinarErro
	}
	return "aceite:" + sessionID + ":" + versaoTermo, nil
}

func (f *fakeTokens) AssinarSessao(sessionID string) (string, error) {
	if f.assinarErro != nil {
		return "", f.assinarErro
	}
	return "sessao:" + sessionID, nil
}

func (f *fakeTokens) VerificarAceite(token string) (string, error) {
	if !f.validos {
		return "", errors.New("token inválido")
	}
	partes := strings.Split(token, ":")
	if len(partes) != 3 || partes[0] != "aceite" {
		return "", errors.New("token malformado")
	}
	return partes[2], nil
}

func (f *fakeTokens) VerificarSessao(token string) (string, error) {
	if !f.validos {
		return "", errors.New("token inválido")
	}
	partes := strings.Split(token, ":")
	if len(partes) != 2 || partes[0] != "sessao" {
		return "", errors.New("token malformado")
	}
	return partes[1], nil
}

// fakeRascunhoRepo é um repositório de rascunho em memória.
type fakeRascunhoRepo struct {
	itens        map[string]*entity.Rascunho
	getErro      error
	ensureErro   error
	ensureChamou int

	putPayloadErro error
	payloadGravado json.RawMessage
	tipoGravado    entity.TipoConstituicao

	putDocErro   error
	docsGravados map[string]string
}

func newFakeRascunhoRepo() *fakeRascunhoRepo {
	return &fakeRascunhoRepo{itens: map[string]*entity.Rascunho{}}
}

func (f *fakeRascunhoRepo) semeia(r *entity.Rascunho) { f.itens[r.SessionID] = r }

func (f *fakeRascunhoRepo) Get(_ context.Context, sessionID string) (*entity.Rascunho, error) {
	if f.getErro != nil {
		return nil, f.getErro
	}
	item, ok := f.itens[sessionID]
	if !ok {
		return nil, nil
	}
	return item, nil
}

func (f *fakeRascunhoRepo) EnsureInicial(_ context.Context, sessionID string) error {
	f.ensureChamou++
	if f.ensureErro != nil {
		return f.ensureErro
	}
	if _, ok := f.itens[sessionID]; !ok {
		f.itens[sessionID] = &entity.Rascunho{SessionID: sessionID, Status: entity.StatusRascunho}
	}
	return nil
}

func (f *fakeRascunhoRepo) PutPayload(_ context.Context, _ string, payload json.RawMessage, tipo entity.TipoConstituicao) error {
	if f.putPayloadErro != nil {
		return f.putPayloadErro
	}
	f.payloadGravado = payload
	f.tipoGravado = tipo
	return nil
}

func (f *fakeRascunhoRepo) PutDocumentoKey(_ context.Context, _ string, campo, key string) error {
	if f.putDocErro != nil {
		return f.putDocErro
	}
	if f.docsGravados == nil {
		f.docsGravados = map[string]string{}
	}
	f.docsGravados[campo] = key
	return nil
}

func (f *fakeRascunhoRepo) MarcarEnviado(context.Context, string, string, entity.TipoConstituicao) error {
	return nil
}

func (f *fakeRascunhoRepo) Delete(_ context.Context, sessionID string) error {
	delete(f.itens, sessionID)
	return nil
}
