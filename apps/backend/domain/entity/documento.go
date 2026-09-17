package entity

import (
	"fmt"
	"regexp"
)

// tiposDocumento mapeia os content-types aceitos para upload de documentos à
// extensão de arquivo correspondente.
var tiposDocumento = map[string]string{
	"application/pdf": "pdf",
	"image/jpeg":      "jpg",
	"image/png":       "png",
}

// campoDocumentoRe restringe o nome de campo de um documento a um identificador
// curto e seguro para compor a key S3.
var campoDocumentoRe = regexp.MustCompile(`^[a-z0-9_]{1,80}$`)

// ExtensaoDocumento devolve a extensão de arquivo para um content-type de
// documento conhecido, ou "bin" quando não reconhecido.
func ExtensaoDocumento(contentType string) string {
	if ext, ok := tiposDocumento[contentType]; ok {
		return ext
	}
	return "bin"
}

// ContentTypeDocumentoPermitido informa se o content-type é aceito para upload
// de documentos (application/pdf, image/jpeg, image/png).
func ContentTypeDocumentoPermitido(contentType string) bool {
	_, ok := tiposDocumento[contentType]
	return ok
}

// CampoDocumentoValido informa se campo é um nome aceitável para um documento:
// minúsculas, dígitos e "_", de 1 a 80 caracteres.
func CampoDocumentoValido(campo string) bool {
	return campoDocumentoRe.MatchString(campo)
}

// ChaveDocumento monta a key S3 de um documento de sessão no formato
// "{sessionID}/documentos/{campo}.{ext}", onde ext é derivada do content-type.
func ChaveDocumento(sessionID, campo, contentType string) string {
	return fmt.Sprintf("%s/documentos/%s.%s", sessionID, campo, ExtensaoDocumento(contentType))
}
