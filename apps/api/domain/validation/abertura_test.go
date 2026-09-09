package validation

import (
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"testing"
)

type casoTeste struct {
	Nome  string          `json:"nome"`
	Modo  string          `json:"modo"`
	Input json.RawMessage `json:"input"`
}

type veredito struct {
	Nome       string   `json:"nome"`
	Aceito     bool     `json:"aceito"`
	IssuePaths []string `json:"issuePaths"`
}

// TestCaracterizacaoAbertura roda o validador Go contra a suíte gerada do Zod
// (scripts/gen-abertura-characterization.mjs) e exige o mesmo veredito:
// aceito/rejeitado + conjunto de caminhos de issue.
func TestCaracterizacaoAbertura(t *testing.T) {
	t.Parallel()

	casos := carregarJSON[[]casoTeste](t, "casos_abertura.json")
	vereditos := carregarJSON[[]veredito](t, "veredito_esperado.json")

	esperadoPorNome := make(map[string]veredito, len(vereditos))
	for _, v := range vereditos {
		esperadoPorNome[v.Nome] = v
	}

	for _, c := range casos {
		t.Run(c.Nome, func(t *testing.T) {
			t.Parallel()

			esperado, ok := esperadoPorNome[c.Nome]
			if !ok {
				t.Fatalf("sem veredito esperado para o caso %q", c.Nome)
			}

			var issues []Issue
			switch c.Modo {
			case "full":
				issues = ValidarAberturaForm(c.Input)
			case "draft":
				issues = ValidarAberturaDraft(c.Input)
			default:
				t.Fatalf("modo desconhecido: %q", c.Modo)
			}

			got := caminhosUnicos(issues)

			if aceito := len(issues) == 0; aceito != esperado.Aceito {
				t.Fatalf("aceito = %v, esperado %v (caminhos: %v)", aceito, esperado.Aceito, got)
			}

			want := slices.Clone(esperado.IssuePaths)
			slices.Sort(want)
			if !slices.Equal(got, want) {
				t.Errorf("issuePaths divergem\n  got  = %v\n  want = %v", got, want)
			}
		})
	}
}

func caminhosUnicos(issues []Issue) []string {
	set := make(map[string]struct{}, len(issues))
	for _, i := range issues {
		set[i.PathString()] = struct{}{}
	}
	out := make([]string, 0, len(set))
	for k := range set {
		out = append(out, k)
	}
	slices.Sort(out)
	return out
}

func carregarJSON[T any](t *testing.T, arquivo string) T {
	t.Helper()
	dados, err := os.ReadFile(filepath.Join("testdata", arquivo))
	if err != nil {
		t.Fatalf("ler %s: %v", arquivo, err)
	}
	var alvo T
	if err := json.Unmarshal(dados, &alvo); err != nil {
		t.Fatalf("decodificar %s: %v", arquivo, err)
	}
	return alvo
}
