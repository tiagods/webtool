package auth

import (
	"net/http"
	"testing"
	"time"
)

func TestCookieBuilder_Atributos(t *testing.T) {
	t.Parallel()

	prod := NewCookieBuilder(true, 2*time.Hour)
	dev := NewCookieBuilder(false, 2*time.Hour)

	t.Run("aceite: HttpOnly, Lax, Path, MaxAge 1 ano, Secure só em prod", func(t *testing.T) {
		t.Parallel()
		c := prod.Aceite("tok")
		if c.Name != CookieAceite || c.Value != "tok" || c.Path != "/" {
			t.Errorf("cookie base inesperado: %+v", c)
		}
		if !c.HttpOnly || c.SameSite != http.SameSiteLaxMode || !c.Secure {
			t.Errorf("atributos de segurança inesperados: %+v", c)
		}
		if c.MaxAge != 365*24*60*60 {
			t.Errorf("MaxAge = %d, esperado %d", c.MaxAge, 365*24*60*60)
		}
		if dev.Aceite("tok").Secure {
			t.Error("Secure não deveria ser setado fora de produção")
		}
	})

	t.Run("sessão: MaxAge = sessionExpiry em segundos", func(t *testing.T) {
		t.Parallel()
		c := prod.Sessao("tok")
		if c.Name != CookieSessao || c.MaxAge != 7200 {
			t.Errorf("cookie de sessão inesperado: %+v", c)
		}
	})

	t.Run("expirar sessão: MaxAge negativo", func(t *testing.T) {
		t.Parallel()
		c := prod.ExpirarSessao()
		if c.Name != CookieSessao || c.Value != "" || c.Path != "/" || c.MaxAge >= 0 {
			t.Errorf("cookie de expiração inesperado: %+v", c)
		}
	})
}
