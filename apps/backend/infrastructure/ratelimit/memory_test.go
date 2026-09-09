package ratelimit

import (
	"testing"
	"time"
)

func TestFixedWindow_Permitir(t *testing.T) {
	t.Parallel()

	relogio := time.Unix(0, 0)
	rl := NewFixedWindow(20, 60*time.Second)
	rl.agora = func() time.Time { return relogio }

	for i := 1; i <= 20; i++ {
		if !rl.Permitir("ip-a") {
			t.Fatalf("requisição %d deveria passar", i)
		}
	}
	if rl.Permitir("ip-a") {
		t.Fatal("21ª requisição deveria ser bloqueada")
	}

	// Outra chave tem orçamento próprio.
	if !rl.Permitir("ip-b") {
		t.Fatal("chave distinta não deveria compartilhar o contador")
	}

	// A janela reinicia após expirar.
	relogio = relogio.Add(60 * time.Second)
	if !rl.Permitir("ip-a") {
		t.Fatal("requisição após o reset da janela deveria passar")
	}
}

func TestFixedWindow_JanelaNaoResetaAntesDoPrazo(t *testing.T) {
	t.Parallel()

	relogio := time.Unix(1000, 0)
	rl := NewFixedWindow(1, 60*time.Second)
	rl.agora = func() time.Time { return relogio }

	if !rl.Permitir("ip") {
		t.Fatal("1ª requisição deveria passar")
	}
	relogio = relogio.Add(59 * time.Second)
	if rl.Permitir("ip") {
		t.Fatal("dentro da janela o limite deve continuar valendo")
	}
}
