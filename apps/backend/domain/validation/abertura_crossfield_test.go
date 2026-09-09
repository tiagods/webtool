package validation

import "testing"

func TestLtdaExigeDoisSocios(t *testing.T) {
	t.Parallel()
	tests := []struct {
		tipo string
		qtd  int
		ok   bool
	}{
		{"ltda", 2, true},
		{"ltda", 3, true},
		{"ltda", 1, false},
		{"ltda", 0, false},
		{"slu", 1, true},
		{"slu", 0, true},
	}
	for _, tc := range tests {
		if got := ltdaExigeDoisSocios(tc.tipo, tc.qtd); got != tc.ok {
			t.Errorf("ltdaExigeDoisSocios(%q, %d) = %v, esperado %v", tc.tipo, tc.qtd, got, tc.ok)
		}
	}
}

func TestCnpjInformadoSeTeveParticipacao(t *testing.T) {
	t.Parallel()
	tests := []struct {
		teve bool
		cnpj string
		ok   bool
	}{
		{false, "", true},
		{false, "irrelevante", true},
		{true, "12.345.678/0001-90", true},
		{true, "", false},
		{true, " ", true}, // sem trim, igual ao Zod (!" " é false)
	}
	for _, tc := range tests {
		if got := cnpjInformadoSeTeveParticipacao(tc.teve, tc.cnpj); got != tc.ok {
			t.Errorf("cnpjInformadoSeTeveParticipacao(%v, %q) = %v, esperado %v", tc.teve, tc.cnpj, got, tc.ok)
		}
	}
}

func TestSomaQuotasFecha100(t *testing.T) {
	t.Parallel()
	tests := []struct {
		nome        string
		percentuais []float64
		ok          bool
	}{
		{"exato", []float64{50, 50}, true},
		{"tres_iguais", []float64{33.34, 33.33, 33.33}, true},
		{"dentro_margem_9999", []float64{49.99, 50.0}, true},
		{"fora_margem_10002", []float64{50.01, 50.01}, false},
		{"vazio", nil, false},
		{"um_100", []float64{100}, true},
	}
	for _, tc := range tests {
		if got := somaQuotasFecha100(tc.percentuais); got != tc.ok {
			t.Errorf("%s: somaQuotasFecha100(%v) = %v, esperado %v", tc.nome, tc.percentuais, got, tc.ok)
		}
	}
}

func TestPeloMenosUmAdministrador(t *testing.T) {
	t.Parallel()
	tests := []struct {
		flags []bool
		ok    bool
	}{
		{[]bool{true, false}, true},
		{[]bool{false, false}, false},
		{[]bool{true}, true},
		{nil, false},
	}
	for _, tc := range tests {
		if got := peloMenosUmAdministrador(tc.flags); got != tc.ok {
			t.Errorf("peloMenosUmAdministrador(%v) = %v, esperado %v", tc.flags, got, tc.ok)
		}
	}
}

func TestQuotasBatemComSocios(t *testing.T) {
	t.Parallel()
	if !quotasBatemComSocios(2, 2) {
		t.Error("2 quotas / 2 sócios deveria bater")
	}
	if quotasBatemComSocios(1, 2) {
		t.Error("1 quota / 2 sócios não deveria bater")
	}
}
