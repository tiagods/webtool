package entity

import "testing"

func TestExtensaoDocumento(t *testing.T) {
	t.Parallel()

	casos := map[string]string{
		"application/pdf":  "pdf",
		"image/jpeg":       "jpg",
		"image/png":        "png",
		"text/plain":       "bin",
		"":                 "bin",
		"application/json": "bin",
	}

	for contentType, esperado := range casos {
		if got := ExtensaoDocumento(contentType); got != esperado {
			t.Errorf("ExtensaoDocumento(%q) = %q, esperado %q", contentType, got, esperado)
		}
	}
}

func TestContentTypeDocumentoPermitido(t *testing.T) {
	t.Parallel()

	permitidos := []string{"application/pdf", "image/jpeg", "image/png"}
	for _, ct := range permitidos {
		if !ContentTypeDocumentoPermitido(ct) {
			t.Errorf("ContentTypeDocumentoPermitido(%q) = false, esperado true", ct)
		}
	}

	negados := []string{"text/plain", "image/gif", "application/octet-stream", ""}
	for _, ct := range negados {
		if ContentTypeDocumentoPermitido(ct) {
			t.Errorf("ContentTypeDocumentoPermitido(%q) = true, esperado false", ct)
		}
	}
}

func TestCampoDocumentoValido(t *testing.T) {
	t.Parallel()

	tests := []struct {
		campo  string
		valido bool
	}{
		{"contrato_social", true},
		{"rg", true},
		{"doc123", true},
		{"a", true},
		{"", false},
		{"Contrato", false},               // maiúscula
		{"doc-social", false},             // hífen
		{"doc social", false},             // espaço
		{"docÇ", false},                   // não-ASCII
		{"../etc/passwd", false},          // separador de path
		{string(make([]byte, 81)), false}, // acima de 80
	}

	for _, tc := range tests {
		if got := CampoDocumentoValido(tc.campo); got != tc.valido {
			t.Errorf("CampoDocumentoValido(%q) = %v, esperado %v", tc.campo, got, tc.valido)
		}
	}
}

func TestChaveDocumento(t *testing.T) {
	t.Parallel()

	got := ChaveDocumento("sess-123", "contrato_social", "application/pdf")
	esperado := "sess-123/documentos/contrato_social.pdf"
	if got != esperado {
		t.Errorf("ChaveDocumento = %q, esperado %q", got, esperado)
	}

	if got := ChaveDocumento("s", "rg", "image/png"); got != "s/documentos/rg.png" {
		t.Errorf("ChaveDocumento (png) = %q", got)
	}
}
