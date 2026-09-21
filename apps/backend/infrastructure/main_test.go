//go:build integration

package infrastructure

import (
	"os"
	"testing"

	testhelpers "github.com/tiagods/webtool/apps/backend/infrastructure/testhelpers"
)

func TestMain(m *testing.M) {
	testhelpers.SetupTestMain()
	code := m.Run()
	testhelpers.Teardown()
	os.Exit(code)
}
