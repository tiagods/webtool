package validation

// Regras da Ficha de Alteração: união discriminada cedente/cessionário, 9 blocos
// por quadro (Q01–Q09) e os refines condicionais.

import (
	"encoding/json"
	"fmt"
	"regexp"
)

var reCNPJ = regexp.MustCompile(`^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$`)

// estadosCivisAlteracao são os valores de estadoCivilAlteracao (difere do enum da
// Abertura: inclui "divorciado").
var estadosCivisAlteracao = []string{
	"solteiro", "casado_comunhao_parcial", "casado_comunhao_universal",
	"casado_separacao_bens", "casado_separacao_obrigatoria",
	"separado_judicialmente", "divorciado", "viuvo",
}

var situacoesCadastrais = []string{"ativa", "inapta", "baixada"}

var tiposConstituicao = []string{"ltda", "slu"}

// quadroParaChave mapeia cada código de quadro para a chave do bloco de dados
// correspondente.
var quadroParaChave = map[string]string{
	"nome_empresarial":       "q01",
	"objeto_social":          "q02",
	"endereco":               "q03",
	"quadro_societario":      "q04",
	"capital_social":         "q05",
	"redistribuicao_capital": "q06",
	"natureza_juridica":      "q07",
	"administracao":          "q08",
	"outras_alteracoes":      "q09",
}

// chavesAlteracaoConhecidas é o conjunto de chaves de topo aceitas — o modo draft
// rejeita qualquer outra.
var chavesAlteracaoConhecidas = map[string]bool{
	"identificacao": true, "quadros": true, "aceite": true,
	"q01": true, "q02": true, "q03": true, "q04": true, "q05": true,
	"q06": true, "q07": true, "q08": true, "q09": true,
}

// --- Structs de parsing (ponteiro = "presente", nil = "ausente") ----------

type enderecoAtualForm struct {
	Logradouro *string `json:"logradouro"`
	Bairro     *string `json:"bairro"`
	Municipio  *string `json:"municipio"`
	Estado     *string `json:"estado"`
	CEP        *string `json:"cep"`
}

type identificacaoForm struct {
	CNPJ             *string            `json:"cnpj"`
	RazaoSocial      *string            `json:"razaoSocial"`
	NomeFantasia     *string            `json:"nomeFantasia"`
	TipoConstituicao *string            `json:"tipoConstituicao"`
	EnderecoAtual    *enderecoAtualForm `json:"enderecoAtual"`
	Situacao         *string            `json:"situacao"`
}

type q01Form struct {
	NomeEmpresarial1 *string `json:"nomeEmpresarial1"`
	NomeEmpresarial2 *string `json:"nomeEmpresarial2"`
	NomeEmpresarial3 *string `json:"nomeEmpresarial3"`
}

type q02Form struct {
	NovoObjetoSocial *string `json:"novoObjetoSocial"`
}

type q03Form struct {
	Logradouro *string `json:"logradouro"`
	Bairro     *string `json:"bairro"`
	Municipio  *string `json:"municipio"`
	Estado     *string `json:"estado"`
	CEP        *string `json:"cep"`
	IPTU       *string `json:"iptu"`
}

type membroForm struct {
	Tipo                   *string  `json:"tipo"`
	NomeCompleto           *string  `json:"nomeCompleto"`
	Naturalidade           *string  `json:"naturalidade"`
	EstadoNaturalidade     *string  `json:"estadoNaturalidade"`
	Profissao              *string  `json:"profissao"`
	RG                     *string  `json:"rg"`
	DigitoRG               *string  `json:"digitoRg"`
	OrgaoExpedidor         *string  `json:"orgaoExpedidor"`
	EstadoExpedidor        *string  `json:"estadoExpedidor"`
	CPF                    *string  `json:"cpf"`
	DataExpedicaoRG        *string  `json:"dataExpedicaoRg"`
	DataNascimento         *string  `json:"dataNascimento"`
	PIS                    *string  `json:"pis"`
	Logradouro             *string  `json:"logradouro"`
	Numero                 *string  `json:"numero"`
	Bairro                 *string  `json:"bairro"`
	Municipio              *string  `json:"municipio"`
	Estado                 *string  `json:"estado"`
	CEP                    *string  `json:"cep"`
	Celular                *string  `json:"celular"`
	Email                  *string  `json:"email"`
	NomeMae                *string  `json:"nomeMae"`
	ParticipacaoAnterior   *string  `json:"participacaoAnterior"`
	CnpjAnterior           *string  `json:"cnpjAnterior"`
	PercentualParticipacao *float64 `json:"percentualParticipacao"`
	ValorParticipacao      *float64 `json:"valorParticipacao"`
	EstadoCivil            *string  `json:"estadoCivil"`
	SocioAdministrador     *string  `json:"socioAdministrador"`
	ProLabore              *float64 `json:"proLabore"`
}

type q04Form struct {
	Membros *[]json.RawMessage `json:"membros"`
}

type q05Form struct {
	ValorCapitalSocial        *float64 `json:"valorCapitalSocial"`
	TipoAlteracao             *string  `json:"tipoAlteracao"`
	ValorIntegralizacao       *float64 `json:"valorIntegralizacao"`
	EspecificarIntegralizacao *string  `json:"especificarIntegralizacao"`
}

type redistribuicaoSocioForm struct {
	NomeSocio  *string  `json:"nomeSocio"`
	Percentual *float64 `json:"percentual"`
	Valor      *float64 `json:"valor"`
}

type q06Form struct {
	Socios *[]redistribuicaoSocioForm `json:"socios"`
}

type q07Form struct {
	TipoTransformacao *string `json:"tipoTransformacao"`
	Especificar       *string `json:"especificar"`
}

type q08Form struct {
	Administradores *[]string `json:"administradores"`
}

type q09Form struct {
	Descricao *string `json:"descricao"`
}

// --- Helpers de campo específicos da Alteração ---------------------------

// obrigNum exige um número presente; nil ⇒ issue "Required" (aborted).
func (v *validador) obrigNum(path []any, val *float64) (float64, bool) {
	if val == nil {
		v.addFatal(path, "Required")
		return 0, false
	}
	return *val, true
}

// positivo: issue quando n <= 0.
func (v *validador) positivo(path []any, n float64, msg string) {
	if n <= 0 {
		v.add(path, msg)
	}
}

func (v *validador) maxLen(path []any, s string, n int, msg string) {
	if len([]rune(s)) > n {
		v.add(path, msg)
	}
}

// --- Entrypoints ------------------------------------------------------

// ValidarAlteracaoForm valida o payload completo da Ficha de Alteração
// (field-level + união discriminada + refines de bloco + cross-quadro). Chaves
// de topo desconhecidas são ignoradas.
func ValidarAlteracaoForm(raw json.RawMessage) []Issue {
	topo, ok := decodificarTopo(raw)
	if !ok {
		return []Issue{{Path: nil, Message: "corpo inválido"}}
	}

	v := &validador{}

	if ident, ok := secao[identificacaoForm](v, topo, "identificacao", true); ok {
		validarIdentificacao(v, ident)
	}
	quadros := parseQuadros(v, topo, true)
	validarAceite(v, topo, true)

	blocoPresente := parseBlocos(v, topo)

	if !v.aborted {
		validarCrossQuadros(v, quadros, blocoPresente)
	}
	return v.issues
}

// ValidarAlteracaoDraft valida um rascunho parcial: chave de topo desconhecida e
// `aceite` não-booleano são rejeitados, qualquer subconjunto das chaves de topo é
// aceito e o cross-quadro não roda. Um bloco presente continua validado por
// inteiro (o parser parcial não desce aos campos) — inclusive o refine interno
// de Q05/Q07.
func ValidarAlteracaoDraft(raw json.RawMessage) []Issue {
	topo, ok := decodificarTopo(raw)
	if !ok {
		return []Issue{{Path: nil, Message: "corpo inválido"}}
	}

	v := &validador{}

	if fora := chavesForaDoConjunto(topo, chavesAlteracaoConhecidas); len(fora) > 0 {
		v.add(nil, "Unrecognized key(s) in object: "+listar(fora))
	}

	if ident, ok := secao[identificacaoForm](v, topo, "identificacao", false); ok {
		validarIdentificacao(v, ident)
	}
	if _, presente := topo["quadros"]; presente {
		parseQuadros(v, topo, false)
	}
	validarAceite(v, topo, false)
	parseBlocos(v, topo)

	return v.issues
}

// chavesForaDoConjunto devolve as chaves de topo que não pertencem a conhecidas.
func chavesForaDoConjunto(topo map[string]json.RawMessage, conhecidas map[string]bool) []string {
	var fora []string
	for k := range topo {
		if !conhecidas[k] {
			fora = append(fora, k)
		}
	}
	return fora
}

// --- identificação ---------------------------------------------------

func validarIdentificacao(v *validador, d *identificacaoForm) {
	base := func(campo ...any) []any { return append([]any{"identificacao"}, campo...) }

	if s, ok := v.obrigStr(base("cnpj"), d.CNPJ); ok {
		v.matches(base("cnpj"), s, reCNPJ, "CNPJ inválido")
	}
	if s, ok := v.obrigStr(base("razaoSocial"), d.RazaoSocial); ok {
		v.minLen(base("razaoSocial"), s, 3, "Informe a razão social")
	}
	if tipo, ok := v.obrigStr(base("tipoConstituicao"), d.TipoConstituicao); ok {
		v.enum(base("tipoConstituicao"), tipo, tiposConstituicao, "Informe o tipo de constituição")
	}
	validarEnderecoAtual(v, d.EnderecoAtual)

	situacao, ok := v.obrigStr(base("situacao"), d.Situacao)
	situacaoValida := ok && v.enumOk(base("situacao"), situacao, situacoesCadastrais, "Informe a situação cadastral")

	// refine (dirty): só roda se o parse do objeto identificacao não abortou.
	if situacaoValida && situacao != "ativa" {
		v.add(base("situacao"), "Apenas empresas com situação ATIVA podem prosseguir com a alteração.")
	}
}

func validarEnderecoAtual(v *validador, e *enderecoAtualForm) {
	base := func(campo string) []any { return p("identificacao", "enderecoAtual", campo) }
	if e == nil {
		v.addFatal(p("identificacao", "enderecoAtual"), "Required")
		return
	}
	if s, ok := v.obrigStr(base("logradouro"), e.Logradouro); ok {
		v.minLen(base("logradouro"), s, 2, "Logradouro inválido")
	}
	if s, ok := v.obrigStr(base("bairro"), e.Bairro); ok {
		v.minLen(base("bairro"), s, 2, "Bairro inválido")
	}
	if s, ok := v.obrigStr(base("municipio"), e.Municipio); ok {
		v.minLen(base("municipio"), s, 2, "Município inválido")
	}
	if s, ok := v.obrigStr(base("estado"), e.Estado); ok {
		v.exatoLen(base("estado"), s, 2, "Estado (UF) inválido")
	}
	if s, ok := v.obrigStr(base("cep"), e.CEP); ok {
		v.matches(base("cep"), s, reCEP, "CEP inválido")
	}
}

// --- quadros + aceite ----------------------------------------------

// parseQuadros lê e valida topo["quadros"]. Ausente + required ⇒ issue "Required"
// (aborted). Presente: exige array não-vazio de códigos de quadro conhecidos.
func parseQuadros(v *validador, topo map[string]json.RawMessage, required bool) []string {
	raw, presente := topo["quadros"]
	if !presente || string(raw) == "null" {
		if required {
			v.addFatal(p("quadros"), "Required")
		}
		return nil
	}
	var lista []string
	if err := json.Unmarshal(raw, &lista); err != nil {
		v.addFatal(p("quadros"), "Selecione pelo menos um quadro")
		return nil
	}
	if len(lista) < 1 {
		v.add(p("quadros"), "Selecione pelo menos um quadro")
	}
	for i, codigo := range lista {
		if _, ok := quadroParaChave[codigo]; !ok {
			v.addFatal(p("quadros", i), "Quadro inválido")
		}
	}
	return lista
}

// validarAceite: no modo full exige o booleano `true` (erro "dirty"); no modo
// draft basta ser booleano.
func validarAceite(v *validador, topo map[string]json.RawMessage, required bool) {
	raw, presente := topo["aceite"]
	if !presente || string(raw) == "null" {
		if required {
			v.addFatal(p("aceite"), "Required")
		}
		return
	}
	var b bool
	if err := json.Unmarshal(raw, &b); err != nil {
		v.addFatal(p("aceite"), "Required")
		return
	}
	if required && !b {
		v.add(p("aceite"), "Você precisa aceitar os termos de consentimento")
	}
}

// --- blocos Q01–Q09 ----------------------------------------------

// parseBlocos valida cada bloco qNN presente no payload e devolve o conjunto de
// chaves presentes (para o cross-quadro do modo full).
func parseBlocos(v *validador, topo map[string]json.RawMessage) map[string]bool {
	presente := map[string]bool{}
	marca := func(chave string, ok bool) {
		if ok {
			presente[chave] = true
		}
	}

	if b, ok := secao[q01Form](v, topo, "q01", false); ok {
		marca("q01", true)
		validarQ01(v, b)
	}
	if b, ok := secao[q02Form](v, topo, "q02", false); ok {
		marca("q02", true)
		validarQ02(v, b)
	}
	if b, ok := secao[q03Form](v, topo, "q03", false); ok {
		marca("q03", true)
		validarQ03(v, b)
	}
	if b, ok := secao[q04Form](v, topo, "q04", false); ok {
		marca("q04", true)
		validarQ04(v, b)
	}
	if b, ok := secao[q05Form](v, topo, "q05", false); ok {
		marca("q05", true)
		validarQ05(v, b)
	}
	if b, ok := secao[q06Form](v, topo, "q06", false); ok {
		marca("q06", true)
		validarQ06(v, b)
	}
	if b, ok := secao[q07Form](v, topo, "q07", false); ok {
		marca("q07", true)
		validarQ07(v, b)
	}
	if b, ok := secao[q08Form](v, topo, "q08", false); ok {
		marca("q08", true)
		validarQ08(v, b)
	}
	if b, ok := secao[q09Form](v, topo, "q09", false); ok {
		marca("q09", true)
		validarQ09(v, b)
	}
	return presente
}

func validarQ01(v *validador, q *q01Form) {
	for i, campo := range []struct {
		nome string
		val  *string
	}{
		{"nomeEmpresarial1", q.NomeEmpresarial1},
		{"nomeEmpresarial2", q.NomeEmpresarial2},
		{"nomeEmpresarial3", q.NomeEmpresarial3},
	} {
		if s, ok := v.obrigStr(p("q01", campo.nome), campo.val); ok {
			v.minLen(p("q01", campo.nome), s, 3,
				fmt.Sprintf("Informe a %dª opção (mín. 3 caracteres)", i+1))
		}
	}
}

func validarQ02(v *validador, q *q02Form) {
	if s, ok := v.obrigStr(p("q02", "novoObjetoSocial"), q.NovoObjetoSocial); ok {
		v.minLen(p("q02", "novoObjetoSocial"), s, 20,
			"Descreva a atividade com mais detalhes (mín. 20 caracteres)")
	}
}

func validarQ03(v *validador, q *q03Form) {
	base := func(campo string) []any { return p("q03", campo) }
	if s, ok := v.obrigStr(base("logradouro"), q.Logradouro); ok {
		v.minLen(base("logradouro"), s, 2, "Logradouro inválido")
	}
	if s, ok := v.obrigStr(base("bairro"), q.Bairro); ok {
		v.minLen(base("bairro"), s, 2, "Bairro inválido")
	}
	if s, ok := v.obrigStr(base("municipio"), q.Municipio); ok {
		v.minLen(base("municipio"), s, 2, "Município inválido")
	}
	if s, ok := v.obrigStr(base("estado"), q.Estado); ok {
		v.exatoLen(base("estado"), s, 2, "Estado (UF) inválido")
	}
	if s, ok := v.obrigStr(base("cep"), q.CEP); ok {
		v.matches(base("cep"), s, reCEP, "CEP inválido")
	}
	if s, ok := v.obrigStr(base("iptu"), q.IPTU); ok {
		v.minLen(base("iptu"), s, 1, "Informe o nº do IPTU")
	}
}

// validarQ04 valida a união discriminada `membros` e, se nenhum membro abortou o
// parse, roda o refine da q04 (cnpjAnterior obrigatório quando houve participação
// anterior).
func validarQ04(v *validador, q *q04Form) {
	if q.Membros == nil {
		v.addFatal(p("q04", "membros"), "Required")
		return
	}
	if len(*q.Membros) < 1 {
		v.add(p("q04", "membros"), "Adicione ao menos um sócio (cedente ou cessionário)")
	}

	membros := make([]membroForm, 0, len(*q.Membros))
	q04Abortou := false
	for idx, raw := range *q.Membros {
		var m membroForm
		if err := json.Unmarshal(raw, &m); err != nil {
			v.addFatal(p("q04", "membros", idx), "estrutura inválida")
			q04Abortou = true
			continue
		}
		if validarMembro(v, idx, &m) {
			q04Abortou = true
		}
		membros = append(membros, m)
	}

	if q04Abortou {
		return
	}
	for idx, m := range membros {
		if !cnpjAnteriorInformado(derefStr(m.ParticipacaoAnterior), derefStr(m.CnpjAnterior)) {
			v.add(p("q04", "membros", idx, "cnpjAnterior"), "Informe o CNPJ da empresa anterior")
		}
	}
}

// validarMembro valida um item da união discriminada. Devolve abortou=true quando
// o discriminador `tipo` é inválido ou um campo obrigatório está ausente/errado de
// tipo.
func validarMembro(v *validador, idx int, m *membroForm) (abortou bool) {
	base := func(campo string) []any { return p("q04", "membros", idx, campo) }

	tipo := derefStr(m.Tipo)
	if tipo != "cedente" && tipo != "cessionario" {
		v.addFatal(base("tipo"), "Invalid discriminator value. Expected 'cedente' | 'cessionario'")
		return true
	}

	// abortou quando surge um erro fatal (invalid_type / enum) durante a
	// validação deste membro — nesse caso o parse da q04 aborta e o refine da
	// q04 não roda.
	jaAbortado := v.aborted

	strMin := func(campo string, val *string, n int, msg string) {
		if s, ok := v.obrigStr(base(campo), val); ok {
			v.minLen(base(campo), s, n, msg)
		}
	}
	strExato := func(campo string, val *string, n int, msg string) {
		if s, ok := v.obrigStr(base(campo), val); ok {
			v.exatoLen(base(campo), s, n, msg)
		}
	}

	strMin("nomeCompleto", m.NomeCompleto, 3, "Informe o nome completo")
	strMin("naturalidade", m.Naturalidade, 2, "Informe a naturalidade")
	strExato("estadoNaturalidade", m.EstadoNaturalidade, 2, "Estado (UF) inválido")
	strMin("profissao", m.Profissao, 2, "Informe a profissão")
	strMin("rg", m.RG, 1, "Informe o RG")
	if s, ok := v.obrigStr(base("digitoRg"), m.DigitoRG); ok {
		v.minLen(base("digitoRg"), s, 1, "Informe o dígito do RG")
		v.maxLen(base("digitoRg"), s, 2, "Dígito do RG inválido")
	}
	strMin("orgaoExpedidor", m.OrgaoExpedidor, 2, "Informe o órgão expedidor")
	strExato("estadoExpedidor", m.EstadoExpedidor, 2, "Estado (UF) inválido")
	if s, ok := v.obrigStr(base("cpf"), m.CPF); ok {
		v.matches(base("cpf"), s, reCPF, "CPF inválido")
	}
	strMin("dataExpedicaoRg", m.DataExpedicaoRG, 1, "Informe a data de expedição do RG")
	strMin("dataNascimento", m.DataNascimento, 1, "Informe a data de nascimento")
	strMin("pis", m.PIS, 1, "Informe o nº do PIS")
	strMin("logradouro", m.Logradouro, 2, "Logradouro inválido")
	strMin("numero", m.Numero, 1, "Informe o número")
	strMin("bairro", m.Bairro, 2, "Bairro inválido")
	strMin("municipio", m.Municipio, 2, "Município inválido")
	strExato("estado", m.Estado, 2, "Estado (UF) inválido")
	if s, ok := v.obrigStr(base("cep"), m.CEP); ok {
		v.matches(base("cep"), s, reCEP, "CEP inválido")
	}
	strMin("celular", m.Celular, 14, "Celular incompleto")
	if s, ok := v.obrigStr(base("email"), m.Email); ok {
		v.matches(base("email"), s, reEmail, "E-mail inválido")
	}
	strMin("nomeMae", m.NomeMae, 3, "Informe o nome da mãe")

	if s, ok := v.obrigStr(base("participacaoAnterior"), m.ParticipacaoAnterior); ok {
		v.enum(base("participacaoAnterior"), s, []string{"sim", "nao"}, "Informe a participação anterior")
	}
	if n, ok := v.obrigNum(base("percentualParticipacao"), m.PercentualParticipacao); ok {
		if n < 0.01 {
			v.add(base("percentualParticipacao"), "Min % é 0.01")
		}
		if n > 100 {
			v.add(base("percentualParticipacao"), "Max % é 100")
		}
	}
	if n, ok := v.obrigNum(base("valorParticipacao"), m.ValorParticipacao); ok {
		v.positivo(base("valorParticipacao"), n, "Informe o valor da participação")
	}
	if s, ok := v.obrigStr(base("estadoCivil"), m.EstadoCivil); ok {
		v.enum(base("estadoCivil"), s, estadosCivisAlteracao, "Estado civil inválido")
	}

	if tipo == "cessionario" {
		if s, ok := v.obrigStr(base("socioAdministrador"), m.SocioAdministrador); ok {
			v.minLen(base("socioAdministrador"), s, 1, "Informe se será sócio administrador")
		}
		if n, ok := v.obrigNum(base("proLabore"), m.ProLabore); ok {
			v.positivo(base("proLabore"), n, "Informe o valor do pró-labore")
		}
	}

	return v.aborted && !jaAbortado
}

func validarQ05(v *validador, q *q05Form) {
	base := func(campo string) []any { return p("q05", campo) }

	abortou := false
	if n, ok := v.obrigNum(base("valorCapitalSocial"), q.ValorCapitalSocial); ok {
		v.positivo(base("valorCapitalSocial"), n, "Informe o valor do capital social")
	} else {
		abortou = true
	}

	tipo, ok := v.obrigStr(base("tipoAlteracao"), q.TipoAlteracao)
	if !ok {
		abortou = true
	} else if !v.enumOk(base("tipoAlteracao"), tipo, []string{"aumento", "reducao"}, "Informe o tipo de alteração") {
		abortou = true
	}

	if q.ValorIntegralizacao != nil {
		v.positivo(base("valorIntegralizacao"), *q.ValorIntegralizacao, "Valor da integralização inválido")
	}
	if q.EspecificarIntegralizacao != nil {
		v.minLen(base("especificarIntegralizacao"), *q.EspecificarIntegralizacao, 5, "Especifique a forma de integralização")
	}

	if abortou || !exigeIntegralizacao(tipo) {
		return
	}
	if q.ValorIntegralizacao == nil || *q.ValorIntegralizacao == 0 {
		v.add(base("valorIntegralizacao"), "Informe o valor da integralização")
	}
	if q.EspecificarIntegralizacao == nil || *q.EspecificarIntegralizacao == "" {
		v.add(base("especificarIntegralizacao"), "Especifique a forma de integralização")
	}
}

func validarQ06(v *validador, q *q06Form) {
	if q.Socios == nil {
		v.addFatal(p("q06", "socios"), "Required")
		return
	}
	if len(*q.Socios) < 1 {
		v.add(p("q06", "socios"), "Adicione ao menos um sócio")
	}
	for i := range *q.Socios {
		s := &(*q.Socios)[i]
		base := func(campo string) []any { return p("q06", "socios", i, campo) }
		if nome, ok := v.obrigStr(base("nomeSocio"), s.NomeSocio); ok {
			v.minLen(base("nomeSocio"), nome, 3, "Informe o nome do sócio")
		}
		if n, ok := v.obrigNum(base("percentual"), s.Percentual); ok {
			if n < 0.01 {
				v.add(base("percentual"), "Min % é 0.01")
			}
			if n > 100 {
				v.add(base("percentual"), "Max % é 100")
			}
		}
		if n, ok := v.obrigNum(base("valor"), s.Valor); ok {
			v.positivo(base("valor"), n, "Informe o valor em R$")
		}
	}
}

func validarQ07(v *validador, q *q07Form) {
	base := func(campo string) []any { return p("q07", campo) }

	tipo, ok := v.obrigStr(base("tipoTransformacao"), q.TipoTransformacao)
	abortou := !ok
	if ok && !v.enumOk(base("tipoTransformacao"), tipo,
		[]string{"ltda_para_simples", "simples_para_ltda", "outras"}, "Informe o tipo de transformação") {
		abortou = true
	}

	if abortou {
		return
	}
	if !especificarTransformacaoInformado(tipo, derefStr(q.Especificar)) {
		v.add(base("especificar"), "Especifique a transformação")
	}
}

func validarQ08(v *validador, q *q08Form) {
	if q.Administradores == nil {
		v.addFatal(p("q08", "administradores"), "Required")
		return
	}
	if len(*q.Administradores) < 1 {
		v.add(p("q08", "administradores"), "Informe ao menos um administrador")
	}
	for i, nome := range *q.Administradores {
		v.minLen(p("q08", "administradores", i), nome, 3, "Informe o nome do administrador")
	}
}

func validarQ09(v *validador, q *q09Form) {
	if s, ok := v.obrigStr(p("q09", "descricao"), q.Descricao); ok {
		v.minLen(p("q09", "descricao"), s, 10, "Descreva a alteração com mais detalhes")
	}
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
