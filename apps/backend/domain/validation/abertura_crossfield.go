package validation

import "math"

// Regras cross-field da Ficha de Abertura. Cada função abaixo é pura e testável
// isoladamente; validarCrossField as orquestra e mapeia cada `false` para a issue
// no caminho correto.
//
// Ordem de avaliação:
//  1. Ltda exige ≥ 2 sócios
//  2. cnpjParticipacao obrigatório quando o sócio teve participação societária
//  3. (só Ltda) sociedade obrigatória; soma das quotas = 100 (±0,01);
//     ≥ 1 administrador; nº de quotas = nº de sócios

// ltdaExigeDoisSocios: false quando é Ltda e há menos de 2 sócios.
func ltdaExigeDoisSocios(tipoConstituicao string, qtdSocios int) bool {
	return tipoConstituicao != "ltda" || qtdSocios >= 2
}

// cnpjInformadoSeTeveParticipacao: false quando o sócio declarou participação
// societária anterior mas não informou o CNPJ (string vazia — sem trim).
func cnpjInformadoSeTeveParticipacao(teveParticipacao bool, cnpj string) bool {
	return !teveParticipacao || cnpj != ""
}

// somaQuotasFecha100: soma dos percentuais das quotas dentro de ±0,01 de 100.
// O fold à esquerda a partir de 0 fixa a ordem de soma do IEEE-754 (ex.:
// 49.99 + 50.0 = 99.99000000000001).
func somaQuotasFecha100(percentuais []float64) bool {
	var total float64
	for _, x := range percentuais {
		total += x
	}
	return math.Abs(total-100) <= 0.01
}

// peloMenosUmAdministrador: ao menos uma quota marcada como administradora.
func peloMenosUmAdministrador(flags []bool) bool {
	for _, f := range flags {
		if f {
			return true
		}
	}
	return false
}

// quotasBatemComSocios: uma quota por sócio.
func quotasBatemComSocios(qtdQuotas, qtdSocios int) bool {
	return qtdQuotas == qtdSocios
}

// validarCrossField roda as regras cross-field sobre o form já parseado. Só é
// chamado quando não houve erro "aborted" — portanto as seções e campos
// obrigatórios acessados aqui são não-nulos.
func validarCrossField(v *validador, form aberturaForm) {
	if form.dadosEmpresa == nil || form.dadosSocios == nil || form.dadosSocios.Socios == nil {
		return
	}

	tipo := deref(form.dadosEmpresa.TipoConstituicao)
	socios := *form.dadosSocios.Socios

	if !ltdaExigeDoisSocios(tipo, len(socios)) {
		v.add(p("dadosSocios", "socios"), "Sociedade Limitada (Ltda) requer pelo menos 2 sócios.")
	}

	for i := range socios {
		teve := derefBool(socios[i].TeveParticipacaoSocietaria)
		cnpj := deref(socios[i].CnpjParticipacao)
		if !cnpjInformadoSeTeveParticipacao(teve, cnpj) {
			v.add(p("dadosSocios", "socios", i, "cnpjParticipacao"), "Informe o CNPJ da empresa anterior")
		}
	}

	if tipo != "ltda" {
		return
	}

	if form.sociedade == nil {
		v.add(p("sociedade"), "Preencha os dados da sociedade.")
		return
	}

	quotas := derefQuotas(form.sociedade.Quotas)
	percentuais := make([]float64, len(quotas))
	flags := make([]bool, len(quotas))
	for i, q := range quotas {
		percentuais[i] = derefFloat(q.Percentual)
		flags[i] = derefBool(q.IsAdministrador)
	}

	if !somaQuotasFecha100(percentuais) {
		v.add(p("sociedade", "quotas"), "A soma das quotas deve fechar exatamente 100%.")
	}
	if !peloMenosUmAdministrador(flags) {
		v.add(p("sociedade", "quotas"), "A sociedade deve conter ao menos 1 administrador.")
	}
	if !quotasBatemComSocios(len(quotas), len(socios)) {
		v.add(p("sociedade", "quotas"), "Cada sócio precisa de uma quota definida.")
	}
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func derefBool(b *bool) bool {
	return b != nil && *b
}

func derefFloat(f *float64) float64 {
	if f == nil {
		return 0
	}
	return *f
}

func derefQuotas(q *[]quotaForm) []quotaForm {
	if q == nil {
		return nil
	}
	return *q
}
