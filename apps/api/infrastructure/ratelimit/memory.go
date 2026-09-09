// Package ratelimit fornece um limitador de requisições por chave (tipicamente
// IP) com janela fixa, em memória. Porta apps/api/lib/rateLimit.ts — suficiente
// para uma instância única; multi-instância exigiria um contador compartilhado.
package ratelimit

import (
	"sync"
	"time"
)

// Padrões espelhando rateLimit.ts: 20 requisições por janela de 60s.
const (
	PadraoLimite = 20
	PadraoJanela = 60 * time.Second
)

type janela struct {
	contagem int
	inicio   time.Time
}

// FixedWindow conta requisições por chave dentro de uma janela de tempo fixa.
// É seguro para uso concorrente.
type FixedWindow struct {
	mu       sync.Mutex
	entradas map[string]janela
	limite   int
	duracao  time.Duration
	agora    func() time.Time
}

// NewFixedWindow cria um limitador que permite no máximo limite requisições por
// chave a cada duracao.
func NewFixedWindow(limite int, duracao time.Duration) *FixedWindow {
	return &FixedWindow{
		entradas: make(map[string]janela),
		limite:   limite,
		duracao:  duracao,
		agora:    time.Now,
	}
}

// Permitir registra uma requisição para chave e devolve false se o limite da
// janela corrente já foi atingido. A janela reinicia quando expira.
func (f *FixedWindow) Permitir(chave string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()

	agora := f.agora()
	atual, existe := f.entradas[chave]

	if !existe || agora.Sub(atual.inicio) >= f.duracao {
		f.entradas[chave] = janela{contagem: 1, inicio: agora}
		return true
	}

	if atual.contagem >= f.limite {
		return false
	}

	atual.contagem++
	f.entradas[chave] = atual
	return true
}
