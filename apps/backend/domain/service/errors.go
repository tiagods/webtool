// Package service reúne os casos de uso de autenticação e sessão da API. Os
// serviços orquestram os ports outbound (repositórios, token, storage) com tipos
// de domínio e não conhecem HTTP, cookies, status codes nem o AWS SDK.
package service

import "errors"

// Erros sentinela do domínio de auth/sessão. O adapter/web os traduz para status
// HTTP: ErrVersaoTermoInvalida → 400; ErrAceiteAusente e ErrSessaoInvalida → 403;
// ErrSessaoEnviada → 409.
var (
	// ErrVersaoTermoInvalida indica que o corpo do aceite trouxe uma versão de
	// termo diferente da vigente (entity.TermoVersaoAtual).
	ErrVersaoTermoInvalida = errors.New("versaoTermo inválida")

	// ErrAceiteAusente indica que a requisição não apresentou um token
	// prolink_aceite válido para a versão vigente do termo.
	ErrAceiteAusente = errors.New("termo de ciência não aceito")

	// ErrSessaoInvalida indica que o token de sessão está ausente, expirado,
	// malformado, ou que a sessão não existe mais na tabela.
	ErrSessaoInvalida = errors.New("sessão inválida ou expirada")

	// ErrSessaoEnviada indica que a sessão já foi submetida (status enviado) e
	// portanto não aceita mais escrita nem exclusão direta.
	ErrSessaoEnviada = errors.New("sessão já enviada")

	// ErrCampoDocumentoInvalido indica que o nome de campo do documento não
	// respeita ^[a-z0-9_]{1,80}$. adapter/web → 400.
	ErrCampoDocumentoInvalido = errors.New("campo inválido")

	// ErrContentTypeDocumentoInvalido indica um content-type de upload fora da
	// lista permitida (application/pdf, image/jpeg, image/png). adapter/web → 400.
	ErrContentTypeDocumentoInvalido = errors.New("contentType deve ser application/pdf, image/jpeg ou image/png")
)
