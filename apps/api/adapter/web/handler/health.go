package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/tiagods/webtool/apps/api/adapter/web/presenter"
)

// Health é a sonda de liveness/readiness. No batch 022 devolve sempre 200; nas
// specs seguintes pode passar a checar dependências (DynamoDB, SQS).
func Health(c echo.Context) error {
	return c.JSON(http.StatusOK, presenter.NewHealth())
}
