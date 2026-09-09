// Package auth implementa a assinatura/verificação dos JWT de autenticação
// (port outbound.TokenService) e a construção dos cookies correspondentes.
//
// Os tokens são HS256 e interoperáveis com o `jose` (jwtVerify) de apps/web:
// mesmo segredo (bytes UTF-8 crus de JWT_SECRET), claims iat/exp em segundos,
// header {"alg":"HS256","typ":"JWT"} — o `typ` extra é ignorado pelo jose.
package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/tiagods/webtool/apps/backend/domain/ports/outbound"
)

// aceiteMaxAge é a validade do token do cookie prolink_aceite (1 ano), espelhando
// ACEITE_COOKIE_MAX_AGE de apps/api/app/api/aceite-termo/route.ts.
const aceiteMaxAge = 365 * 24 * time.Hour

// claimVersaoTermo é a claim custom que carrega a versão do termo aceita.
const claimVersaoTermo = "versaoTermo"

// aceiteClaims são as claims do token de aceite: sub + versaoTermo + iat/exp.
type aceiteClaims struct {
	VersaoTermo string `json:"versaoTermo"`
	jwt.RegisteredClaims
}

// JWTTokenService implementa outbound.TokenService com golang-jwt/jwt/v5.
type JWTTokenService struct {
	secret        []byte
	sessionExpiry time.Duration
	now           func() time.Time
}

var _ outbound.TokenService = (*JWTTokenService)(nil)

// NewJWTTokenService liga o serviço ao segredo HS256 e à validade do token de
// sessão (SESSION_EXPIRY_SECONDS).
func NewJWTTokenService(secret string, sessionExpiry time.Duration) *JWTTokenService {
	return &JWTTokenService{
		secret:        []byte(secret),
		sessionExpiry: sessionExpiry,
		now:           time.Now,
	}
}

// AssinarAceite emite o token do cookie prolink_aceite (validade de 1 ano).
func (s *JWTTokenService) AssinarAceite(sessionID, versaoTermo string) (string, error) {
	agora := s.now()
	claims := aceiteClaims{
		VersaoTermo: versaoTermo,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   sessionID,
			IssuedAt:  jwt.NewNumericDate(agora),
			ExpiresAt: jwt.NewNumericDate(agora.Add(aceiteMaxAge)),
		},
	}
	return s.assinar(claims)
}

// AssinarSessao emite o token do cookie prolink_session (validade =
// SESSION_EXPIRY_SECONDS).
func (s *JWTTokenService) AssinarSessao(sessionID string) (string, error) {
	agora := s.now()
	claims := jwt.RegisteredClaims{
		Subject:   sessionID,
		IssuedAt:  jwt.NewNumericDate(agora),
		ExpiresAt: jwt.NewNumericDate(agora.Add(s.sessionExpiry)),
	}
	return s.assinar(claims)
}

// VerificarAceite valida assinatura/expiração e devolve a claim versaoTermo.
func (s *JWTTokenService) VerificarAceite(token string) (string, error) {
	claims := &aceiteClaims{}
	if err := s.verificar(token, claims); err != nil {
		return "", err
	}
	if claims.VersaoTermo == "" {
		return "", fmt.Errorf("token de aceite sem claim %s", claimVersaoTermo)
	}
	return claims.VersaoTermo, nil
}

// VerificarSessao valida assinatura/expiração e devolve a claim sub (sessionID).
func (s *JWTTokenService) VerificarSessao(token string) (string, error) {
	claims := &jwt.RegisteredClaims{}
	if err := s.verificar(token, claims); err != nil {
		return "", err
	}
	if claims.Subject == "" {
		return "", errors.New("token de sessão sem claim sub")
	}
	return claims.Subject, nil
}

func (s *JWTTokenService) assinar(claims jwt.Claims) (string, error) {
	assinado, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.secret)
	if err != nil {
		return "", fmt.Errorf("assinar jwt: %w", err)
	}
	return assinado, nil
}

func (s *JWTTokenService) verificar(token string, claims jwt.Claims) error {
	chave := func(*jwt.Token) (any, error) { return s.secret, nil }
	if _, err := jwt.ParseWithClaims(token, claims, chave, jwt.WithValidMethods([]string{"HS256"})); err != nil {
		return fmt.Errorf("verificar jwt: %w", err)
	}
	return nil
}
