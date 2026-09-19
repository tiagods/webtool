// Package presenter contém os contratos da API HTTP: os structs de request e
// response dos handlers, com as tags `json` que definem o formato do wire. Só o
// pacote adapter/web/handler deve importá-lo. Um presenter é construído a partir
// de um tipo de domínio (entity ou retorno de serviço) e serializado de volta;
// nunca carrega regra de negócio.
package presenter

import (
	"encoding/json"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/domain/validation"
)

// --- Requests ----------------------------------------------------------------

// AceiteRequest é o corpo de POST /api/aceite-termo.
type AceiteRequest struct {
	VersaoTermo string `json:"versaoTermo"`
}

// UploadConfirmacao é a variante {uploadedCampo, contentType} do POST /api/draft:
// o cliente confirma que concluiu um upload direto ao S3.
type UploadConfirmacao struct {
	UploadedCampo *string `json:"uploadedCampo"`
	ContentType   string  `json:"contentType"`
}

// UploadURLRequest é o corpo de POST /api/upload-url.
type UploadURLRequest struct {
	Campo       string `json:"campo"`
	ContentType string `json:"contentType"`
}

// --- Responses --------------------------------------------------------------

// OK é o corpo `{"ok": true}` das rotas de auth/sessão.
type OK struct {
	OK bool `json:"ok"`
}

// NewOK devolve o corpo padrão de sucesso.
func NewOK() OK { return OK{OK: true} }

// Health é o corpo de GET /health.
type Health struct {
	Status string `json:"status"`
}

// NewHealth devolve o corpo da sonda de liveness/readiness (status "ok").
func NewHealth() Health { return Health{Status: "ok"} }

// Draft é o corpo de GET /api/draft. Payload e DocumentosKeys serializam como
// `null` quando ausentes.
type Draft struct {
	Payload        json.RawMessage   `json:"payload"`
	DocumentosKeys map[string]string `json:"documentosKeys"`
}

// DraftFromRascunho projeta o rascunho da sessão no corpo da resposta. r nil
// (sessão sem rascunho gravado) ⇒ payload/documentosKeys nulos.
func DraftFromRascunho(r *entity.Rascunho) Draft {
	if r == nil {
		return Draft{}
	}
	return Draft{Payload: r.Payload, DocumentosKeys: r.DocumentosKeys}
}

// AlteracaoDraft é o corpo de GET /api/alteracao/draft. O formulário de Alteração
// não tem upload, então só `{payload}` é devolvido; payload nulo serializa como
// `null`.
type AlteracaoDraft struct {
	Payload json.RawMessage `json:"payload"`
}

// NewAlteracaoDraft projeta o rascunho da sessão de alteração no corpo da
// resposta. r nil (sessão sem rascunho gravado) ⇒ payload nulo.
func NewAlteracaoDraft(r *entity.Rascunho) AlteracaoDraft {
	if r == nil {
		return AlteracaoDraft{}
	}
	return AlteracaoDraft{Payload: r.Payload}
}

// Submit é o corpo de sucesso de POST /api/submit — só o protocolo gerado.
type Submit struct {
	Protocolo string `json:"protocolo"`
}

// NewSubmit devolve o corpo de sucesso do submit.
func NewSubmit(protocolo string) Submit { return Submit{Protocolo: protocolo} }

// UploadURL é o corpo de POST /api/upload-url — só a URL assinada (a key S3
// contém o sessionID e não volta ao cliente).
type UploadURL struct {
	URL string `json:"url"`
}

// NewUploadURL devolve o corpo com a URL PUT pré-assinada.
func NewUploadURL(url string) UploadURL { return UploadURL{URL: url} }

// PayloadInvalido é o corpo 400:
// {"error":"Payload inválido","issues":[{"path":[...],"message":"..."}]}.
type PayloadInvalido struct {
	Error  string  `json:"error"`
	Issues []Issue `json:"issues"`
}

// Issue é um item de PayloadInvalido.Issues.
type Issue struct {
	Path    []any  `json:"path"`
	Message string `json:"message"`
}

// NewPayloadInvalido converte as issues do validador de domínio no corpo de erro
// 400. Path nil vira `[]`, nunca `null`.
func NewPayloadInvalido(issues []validation.Issue) PayloadInvalido {
	dtos := make([]Issue, len(issues))
	for i, is := range issues {
		caminho := is.Path
		if caminho == nil {
			caminho = []any{}
		}
		dtos[i] = Issue{Path: caminho, Message: is.Message}
	}
	return PayloadInvalido{Error: "Payload inválido", Issues: dtos}
}
