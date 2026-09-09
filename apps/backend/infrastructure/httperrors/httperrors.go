// Package httperrors define um erro de transporte agnóstico de domínio: um
// status HTTP, uma mensagem segura para o cliente e uma causa opcional que
// permanece apenas no servidor (log), nunca no corpo da resposta.
package httperrors

import (
	"fmt"
	"net/http"
)

// HTTPError carrega o status e a mensagem que devem ir para o cliente. Err é a
// causa interna — logada, jamais serializada.
type HTTPError struct {
	Status  int
	Message string
	Err     error
}

func (e *HTTPError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%d %s: %v", e.Status, e.Message, e.Err)
	}
	return fmt.Sprintf("%d %s", e.Status, e.Message)
}

// Unwrap expõe a causa interna para errors.Is / errors.As.
func (e *HTTPError) Unwrap() error { return e.Err }

// New cria um HTTPError sem causa interna.
func New(status int, message string) *HTTPError {
	return &HTTPError{Status: status, Message: message}
}

// Wrap cria um HTTPError preservando err como causa interna.
func Wrap(status int, message string, err error) *HTTPError {
	return &HTTPError{Status: status, Message: message, Err: err}
}

// BadRequest é o atalho para um HTTPError 400.
func BadRequest(message string) *HTTPError {
	return New(http.StatusBadRequest, message)
}

// Forbidden é o atalho para um HTTPError 403.
func Forbidden(message string) *HTTPError {
	return New(http.StatusForbidden, message)
}

// Conflict é o atalho para um HTTPError 409.
func Conflict(message string) *HTTPError {
	return New(http.StatusConflict, message)
}

// TooManyRequests é o atalho para um HTTPError 429.
func TooManyRequests(message string) *HTTPError {
	return New(http.StatusTooManyRequests, message)
}

// Internal envolve err como 500 com mensagem genérica.
func Internal(err error) *HTTPError {
	return &HTTPError{Status: http.StatusInternalServerError, Message: "erro interno", Err: err}
}
