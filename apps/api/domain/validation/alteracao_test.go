package validation

import (
	"encoding/json"
	"slices"
	"testing"
)

// TestCaracterizacaoAlteracao roda o validador Go contra a suíte gerada do Zod
// (scripts/gen-alteracao-characterization.mjs) e exige o mesmo veredito:
// aceito/rejeitado + conjunto de caminhos de issue.
func TestCaracterizacaoAlteracao(t *testing.T) {
	t.Parallel()

	casos := carregarJSON[[]casoTeste](t, "casos_alteracao.json")
	vereditos := carregarJSON[[]veredito](t, "veredito_alteracao_esperado.json")

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
				issues = ValidarAlteracaoForm(c.Input)
			case "draft":
				issues = ValidarAlteracaoDraft(c.Input)
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

// TestAlteracaoUniaoDiscriminada cobre a discriminação por `tipo` fora da suíte
// de caracterização (foco no comportamento do discriminador em si).
func TestAlteracaoUniaoDiscriminada(t *testing.T) {
	t.Parallel()

	tests := []struct {
		nome     string
		tipo     string
		querPath string
		querErro bool
	}{
		{"tipo ausente", "", "q04/membros/0/tipo", true},
		{"tipo desconhecido", "socio", "q04/membros/0/tipo", true},
		{"cedente valido", "cedente", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.nome, func(t *testing.T) {
			t.Parallel()
			membro := membroValidoJSON(tt.tipo)
			payload := formAlteracaoComQ04(t, membro)

			issues := ValidarAlteracaoForm(payload)
			if tt.querErro && len(issues) == 0 {
				t.Fatalf("esperava issue, veio nenhuma")
			}
			if !tt.querErro && len(issues) > 0 {
				t.Fatalf("esperava aceito, veio %v", caminhosUnicos(issues))
			}
			if tt.querPath != "" && !slices.Contains(caminhosUnicos(issues), tt.querPath) {
				t.Errorf("faltou issue em %q; veio %v", tt.querPath, caminhosUnicos(issues))
			}
		})
	}
}

// TestAlteracaoRefinesCondicionais cobre Q05 (aumento) e Q07 (outras) com tabela.
func TestAlteracaoRefinesCondicionais(t *testing.T) {
	t.Parallel()

	t.Run("Q05 aumento sem integralizacao", func(t *testing.T) {
		t.Parallel()
		issues := ValidarAlteracaoDraft(json.RawMessage(
			`{"q05":{"valorCapitalSocial":10000,"tipoAlteracao":"aumento"}}`))
		got := caminhosUnicos(issues)
		want := []string{"q05/especificarIntegralizacao", "q05/valorIntegralizacao"}
		if !slices.Equal(got, want) {
			t.Errorf("got %v want %v", got, want)
		}
	})

	t.Run("Q05 reducao ok", func(t *testing.T) {
		t.Parallel()
		issues := ValidarAlteracaoDraft(json.RawMessage(
			`{"q05":{"valorCapitalSocial":10000,"tipoAlteracao":"reducao"}}`))
		if len(issues) > 0 {
			t.Errorf("esperava aceito, veio %v", caminhosUnicos(issues))
		}
	})

	t.Run("Q07 outras sem especificar", func(t *testing.T) {
		t.Parallel()
		issues := ValidarAlteracaoDraft(json.RawMessage(`{"q07":{"tipoTransformacao":"outras"}}`))
		got := caminhosUnicos(issues)
		if !slices.Equal(got, []string{"q07/especificar"}) {
			t.Errorf("got %v", got)
		}
	})

	t.Run("Q07 outras com especificar ok", func(t *testing.T) {
		t.Parallel()
		issues := ValidarAlteracaoDraft(json.RawMessage(
			`{"q07":{"tipoTransformacao":"outras","especificar":"cooperativa"}}`))
		if len(issues) > 0 {
			t.Errorf("esperava aceito, veio %v", caminhosUnicos(issues))
		}
	})
}

// --- helpers de teste ---------------------------------------------------

func membroValidoJSON(tipo string) json.RawMessage {
	m := map[string]any{
		"nomeCompleto": "Joao da Silva Santos", "naturalidade": "Sao Paulo",
		"estadoNaturalidade": "SP", "profissao": "engenheiro", "rg": "12345678",
		"digitoRg": "9", "orgaoExpedidor": "SSP", "estadoExpedidor": "SP",
		"cpf": "123.456.789-00", "dataExpedicaoRg": "2010-01-15", "dataNascimento": "1985-06-20",
		"pis": "12345678901", "logradouro": "Rua das Flores", "numero": "100",
		"bairro": "Centro", "municipio": "Sao Paulo", "estado": "SP", "cep": "01310-100",
		"celular": "(11) 98765-4321", "email": "joao@example.com", "nomeMae": "Maria da Silva Santos",
		"participacaoAnterior": "nao", "percentualParticipacao": 50, "valorParticipacao": 5000,
		"estadoCivil": "solteiro",
	}
	if tipo != "" {
		m["tipo"] = tipo
	}
	if tipo == "cessionario" {
		m["socioAdministrador"] = "sim"
		m["proLabore"] = 2000
	}
	b, _ := json.Marshal(m)
	return b
}

func formAlteracaoComQ04(t *testing.T, membro json.RawMessage) json.RawMessage {
	t.Helper()
	form := map[string]any{
		"identificacao": map[string]any{
			"cnpj": "12.345.678/0001-90", "razaoSocial": "Prolink Servicos Ltda",
			"tipoConstituicao": "ltda", "situacao": "ativa",
			"enderecoAtual": map[string]any{
				"logradouro": "Avenida Paulista", "bairro": "Bela Vista",
				"municipio": "Sao Paulo", "estado": "SP", "cep": "01310-100",
			},
		},
		"quadros": []string{"quadro_societario"},
		"q04":     map[string]any{"membros": []json.RawMessage{membro}},
		"aceite":  true,
	}
	b, err := json.Marshal(form)
	if err != nil {
		t.Fatalf("montar form: %v", err)
	}
	return b
}
