package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/tiagods/webtool/apps/backend/adapter/web/presenter"
)

// Health é a sonda de liveness/readiness; hoje sempre 200.
func Health(c echo.Context) error {
	return c.JSON(http.StatusOK, presenter.NewHealth())
}
