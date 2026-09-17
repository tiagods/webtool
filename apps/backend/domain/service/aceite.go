package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/tiagods/webtool/apps/backend/domain/entity"
	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound"
)

// AceiteService registra o aceite do termo de consentimento LGPD de uma sessão e
// emite o token do cookie prolink_aceite.
type AceiteService struct {
	repo   outbound.AceiteRepository
	tokens outbound.TokenService
}

// NewAceiteService injeta o repositório de aceites e o serviço de token.
func NewAceiteService(repo outbound.AceiteRepository, tokens outbound.TokenService) *AceiteService {
	return &AceiteService{repo: repo, tokens: tokens}
}

// RegistrarAceite valida a versão do termo, persiste o RegistroAceite (com um
// sessionID novo) e devolve o token assinado do cookie prolink_aceite. Retorna
// ErrVersaoTermoInvalida se versaoTermo não for a vigente.
func (s *AceiteService) RegistrarAceite(ctx context.Context, versaoTermo, ip, userAgent string) (string, error) {
	if versaoTermo != entity.TermoVersaoAtual {
		return "", ErrVersaoTermoInvalida
	}

	sessionID := uuid.NewString()
	registro := entity.RegistroAceite{
		SessionID:   sessionID,
		VersaoTermo: entity.TermoVersaoAtual,
		AceitoEm:    time.Now().UTC().Format(time.RFC3339Nano),
		IP:          ip,
		UserAgent:   userAgent,
	}

	if err := s.repo.Put(ctx, registro); err != nil {
		return "", fmt.Errorf("registrar aceite: %w", err)
	}

	token, err := s.tokens.AssinarAceite(sessionID, entity.TermoVersaoAtual)
	if err != nil {
		return "", fmt.Errorf("assinar token de aceite: %w", err)
	}
	return token, nil
}
