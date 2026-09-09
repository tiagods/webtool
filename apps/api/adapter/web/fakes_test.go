package web_test

import (
	"context"
	"encoding/json"

	"github.com/tiagods/webtool/apps/api/domain/entity"
)

// Os ports que são puros spies (AceiteRepository, DocumentoStorage,
// ProtocoloCounter, SubmissaoPublisher) usam os mocks gerados em
// domain/ports/outbound/mocks. O repositório de rascunho continua um fake à mão:
// os testes de handler dependem dele como store stateful (semeia + itens).

// fakeRascunhoRepo é um repositório de rascunho em memória para os testes HTTP.
type fakeRascunhoRepo struct {
	itens map[string]*entity.Rascunho

	payloadGravado json.RawMessage
	tipoGravado    entity.TipoConstituicao
	docsGravados   map[string]string
	putPayloadErro error

	enviadoProtocolo string
	enviadoTipo      entity.TipoConstituicao
}

func novoFakeRascunhoRepo() *fakeRascunhoRepo {
	return &fakeRascunhoRepo{itens: map[string]*entity.Rascunho{}, docsGravados: map[string]string{}}
}

func (f *fakeRascunhoRepo) semeia(r *entity.Rascunho) { f.itens[r.SessionID] = r }

func (f *fakeRascunhoRepo) Get(_ context.Context, sessionID string) (*entity.Rascunho, error) {
	item, ok := f.itens[sessionID]
	if !ok {
		return nil, nil
	}
	return item, nil
}

func (f *fakeRascunhoRepo) EnsureInicial(_ context.Context, sessionID string) error {
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
	f.docsGravados[campo] = key
	return nil
}

func (f *fakeRascunhoRepo) MarcarEnviado(_ context.Context, _, protocolo string, tipo entity.TipoConstituicao) error {
	f.enviadoProtocolo = protocolo
	f.enviadoTipo = tipo
	return nil
}

func (f *fakeRascunhoRepo) Delete(_ context.Context, sessionID string) error {
	delete(f.itens, sessionID)
	return nil
}
