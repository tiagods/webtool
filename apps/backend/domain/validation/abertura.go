// Package validation reimplementa em Go as regras de validação da Ficha de
// Abertura definidas em packages/shared/src/schemas/abertura.ts (Zod). É código
// de domínio puro: depende apenas da stdlib. A suíte de caracterização em
// testdata/ (gerada por scripts/gen-abertura-characterization.mjs) fixa o
// veredito esperado do Zod para cada payload — o validador aqui tem que produzir
// o mesmo veredito (aceito/rejeitado + caminhos das issues).
package validation

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"
)

// Issue descreve uma violação de regra. Path espelha o `path` das issues do Zod
// (ex.: ["dadosSocios","socios",0,"cpf"]); Message é a mensagem exibível.
type Issue struct {
	Path    []any
	Message string
}

// PathString serializa o Path como "a/b/0/c". Path vazio (issue de raiz) vira
// "(root)" — mesmo formato usado por scripts/gen-abertura-characterization.mjs.
func (i Issue) PathString() string {
	if len(i.Path) == 0 {
		return "(root)"
	}
	partes := make([]string, len(i.Path))
	for idx, p := range i.Path {
		switch v := p.(type) {
		case string:
			partes[idx] = v
		case int:
			partes[idx] = strconv.Itoa(v)
		default:
			partes[idx] = fmt.Sprint(v)
		}
	}
	return strings.Join(partes, "/")
}

// --- Regex de campo (espelham abertura.ts) --------------------------------

var (
	reCEP   = regexp.MustCompile(`^\d{5}-\d{3}$`)
	rePIS   = regexp.MustCompile(`^\d{3}\.\d{5}\.\d{2}-\d$`)
	reCPF   = regexp.MustCompile(`^\d{3}\.\d{3}\.\d{3}-\d{2}$`)
	reEmail = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
)

var estadosCivis = []string{
	"solteiro", "casado_comunhao_parcial", "casado_comunhao_universal",
	"casado_separacao_bens", "casado_separacao_obrigatoria",
	"viuvo", "separado_judicialmente",
}

// chavesAberturaConhecidas é o conjunto de chaves de topo aceitas — o modo draft
// (.strict() no Zod) rejeita qualquer outra.
var chavesAberturaConhecidas = map[string]bool{
	"dadosEmpresa": true, "endereco": true, "dadosSocios": true,
	"sociedade": true, "senhaGovBr": true, "documentosAceitos": true,
}

// --- Structs de parsing (ponteiro = "presente", nil = "ausente") ----------

type dadosEmpresaForm struct {
	TipoConstituicao *string `json:"tipoConstituicao"`
	NomeEmpresarial1 *string `json:"nomeEmpresarial1"`
	NomeEmpresarial2 *string `json:"nomeEmpresarial2"`
	NomeEmpresarial3 *string `json:"nomeEmpresarial3"`
	NomeFantasia     *string `json:"nomeFantasia"`
	Atividade        *string `json:"atividade"`
}

type enderecoForm struct {
	CEP           *string `json:"cep"`
	Logradouro    *string `json:"logradouro"`
	Numero        *string `json:"numero"`
	Complemento   *string `json:"complemento"`
	Bairro        *string `json:"bairro"`
	Municipio     *string `json:"municipio"`
	Estado        *string `json:"estado"`
	IPTU          *string `json:"iptu"`
	ImovelAlugado *bool   `json:"imovelAlugado"`
}

type socioForm struct {
	Nome                       *string  `json:"nome"`
	PIS                        *string  `json:"pis"`
	CPF                        *string  `json:"cpf"`
	RG                         *string  `json:"rg"`
	Nacionalidade              *string  `json:"nacionalidade"`
	Profissao                  *string  `json:"profissao"`
	ProLabore                  *float64 `json:"proLabore"`
	TelefoneCelular            *string  `json:"telefoneCelular"`
	TelefoneFixo               *string  `json:"telefoneFixo"`
	Email                      *string  `json:"email"`
	EstadoCivil                *string  `json:"estadoCivil"`
	NomeMae                    *string  `json:"nomeMae"`
	NomePai                    *string  `json:"nomePai"`
	CEPRegistro                *string  `json:"cepRegistro"`
	LogradouroRegistro         *string  `json:"logradouroRegistro"`
	NumeroRegistro             *string  `json:"numeroRegistro"`
	ComplementoRegistro        *string  `json:"complementoRegistro"`
	BairroRegistro             *string  `json:"bairroRegistro"`
	RegistroConselho           *string  `json:"registroConselho"`
	TeveParticipacaoSocietaria *bool    `json:"teveParticipacaoSocietaria"`
	CnpjParticipacao           *string  `json:"cnpjParticipacao"`
}

type dadosSociosForm struct {
	Socios *[]socioForm `json:"socios"`
}

type quotaForm struct {
	Percentual      *float64 `json:"percentual"`
	IsAdministrador *bool    `json:"isAdministrador"`
}

type sociedadeForm struct {
	CapitalSocial     *float64     `json:"capitalSocial"`
	Quotas            *[]quotaForm `json:"quotas"`
	TipoAdministracao *string      `json:"tipoAdministracao"`
	Banco             *string      `json:"banco"`
}

// --- Acumulador ---------------------------------------------------------

// validador acumula as issues e sinaliza se algum erro "aborted" (invalid_type /
// invalid_enum_value no Zod) já apareceu — nesse caso o cross-field não roda.
type validador struct {
	issues  []Issue
	aborted bool
}

func (v *validador) add(path []any, msg string) {
	v.issues = append(v.issues, Issue{Path: path, Message: msg})
}

func (v *validador) addFatal(path []any, msg string) {
	v.add(path, msg)
	v.aborted = true
}

func p(parts ...any) []any { return parts }

// obrigStr exige uma string presente; nil ⇒ issue "Required" (aborted).
func (v *validador) obrigStr(path []any, val *string) (string, bool) {
	if val == nil {
		v.addFatal(path, "Required")
		return "", false
	}
	return *val, true
}

func (v *validador) minLen(path []any, s string, n int, msg string) {
	if utf8.RuneCountInString(s) < n {
		v.add(path, msg)
	}
}

func (v *validador) exatoLen(path []any, s string, n int, msg string) {
	if utf8.RuneCountInString(s) != n {
		v.add(path, msg)
	}
}

func (v *validador) matches(path []any, s string, re *regexp.Regexp, msg string) {
	if !re.MatchString(s) {
		v.add(path, msg)
	}
}

func (v *validador) enum(path []any, s string, permitidos []string, msg string) {
	v.enumOk(path, s, permitidos, msg)
}

// enumOk é a variante de enum que devolve se o valor era permitido — usada pelos
// validadores de bloco da Alteração, que precisam do resultado para decidir se
// rodam o refine condicional do bloco.
func (v *validador) enumOk(path []any, s string, permitidos []string, msg string) bool {
	for _, x := range permitidos {
		if s == x {
			return true
		}
	}
	v.addFatal(path, msg)
	return false
}

// --- Entrypoints ------------------------------------------------------

// ValidarAberturaForm valida o payload completo da Ficha de Abertura
// (aberturaFormSchema do Zod): field-level + cross-field. Chaves de topo
// desconhecidas são ignoradas (o schema completo não é `.strict()`).
func ValidarAberturaForm(raw json.RawMessage) []Issue {
	topo, ok := decodificarTopo(raw)
	if !ok {
		return []Issue{{Path: nil, Message: "corpo inválido"}}
	}

	v := &validador{}
	form := parseAberturaForm(v, topo, true)

	if !v.aborted {
		validarCrossField(v, form)
	}
	return v.issues
}

// ValidarAberturaDraft valida um rascunho parcial (aberturaFormDraftSchema):
// `.strict()` (chave de topo desconhecida ⇒ issue), `.partial()` (qualquer
// subconjunto das chaves), sem cross-field, e `documentosAceitos` apenas como
// booleano opcional (sem exigir `true`).
func ValidarAberturaDraft(raw json.RawMessage) []Issue {
	topo, ok := decodificarTopo(raw)
	if !ok {
		return []Issue{{Path: nil, Message: "corpo inválido"}}
	}

	v := &validador{}

	desconhecidas := chavesDesconhecidas(topo)
	if len(desconhecidas) > 0 {
		v.add(nil, "Unrecognized key(s) in object: "+listar(desconhecidas))
	}

	parseAberturaForm(v, topo, false)
	return v.issues
}

// decodificarTopo lê o objeto raiz como mapa de RawMessage (chaves ainda não
// interpretadas). ok=false se o corpo não for um objeto JSON.
func decodificarTopo(raw json.RawMessage) (map[string]json.RawMessage, bool) {
	var topo map[string]json.RawMessage
	if err := json.Unmarshal(raw, &topo); err != nil || topo == nil {
		return nil, false
	}
	return topo, true
}

func chavesDesconhecidas(topo map[string]json.RawMessage) []string {
	var fora []string
	for k := range topo {
		if !chavesAberturaConhecidas[k] {
			fora = append(fora, k)
		}
	}
	return fora
}

func listar(chaves []string) string {
	aspas := make([]string, len(chaves))
	for i, c := range chaves {
		aspas[i] = "'" + c + "'"
	}
	return strings.Join(aspas, ", ")
}

// --- Parsing + field-level -------------------------------------------

// aberturaForm reúne as seções já parseadas, usado pelo cross-field.
type aberturaForm struct {
	dadosEmpresa *dadosEmpresaForm
	dadosSocios  *dadosSociosForm
	sociedade    *sociedadeForm
}

// parseAberturaForm decodifica e valida cada seção presente. required=true
// (modo full) transforma seção ausente em issue "Required"; required=false
// (modo draft) apenas ignora seções ausentes.
func parseAberturaForm(v *validador, topo map[string]json.RawMessage, required bool) aberturaForm {
	var form aberturaForm

	if de, ok := secao[dadosEmpresaForm](v, topo, "dadosEmpresa", required); ok {
		form.dadosEmpresa = de
		validarDadosEmpresa(v, de)
	}
	if end, ok := secao[enderecoForm](v, topo, "endereco", required); ok {
		validarEndereco(v, end)
	}
	if ds, ok := secao[dadosSociosForm](v, topo, "dadosSocios", required); ok {
		form.dadosSocios = ds
		validarDadosSocios(v, ds)
	}
	// sociedade é sempre opcional no schema completo (a exigência em Ltda é
	// cross-field), então required não se aplica a ela.
	if soc, ok := secao[sociedadeForm](v, topo, "sociedade", false); ok {
		form.sociedade = soc
		validarSociedade(v, soc)
	}
	if raw, presente := topo["documentosAceitos"]; presente {
		validarDocumentosAceitos(v, raw, required)
	} else if required {
		v.addFatal(p("documentosAceitos"), "Required")
	}
	// senhaGovBr: string opcional — sem regra além do tipo, tratada leniente.

	return form
}

// secao decodifica topo[chave] em T. Ausente + required ⇒ issue "Required"
// (aborted) e ok=false. Erro de tipo na decodificação ⇒ issue (aborted).
func secao[T any](v *validador, topo map[string]json.RawMessage, chave string, required bool) (*T, bool) {
	raw, presente := topo[chave]
	if !presente || string(raw) == "null" {
		if required {
			v.addFatal(p(chave), "Required")
		}
		return nil, false
	}
	var alvo T
	if err := json.Unmarshal(raw, &alvo); err != nil {
		v.addFatal(p(chave), "estrutura inválida")
		return nil, false
	}
	return &alvo, true
}

func validarDadosEmpresa(v *validador, d *dadosEmpresaForm) {
	if tipo, ok := v.obrigStr(p("dadosEmpresa", "tipoConstituicao"), d.TipoConstituicao); ok {
		v.enum(p("dadosEmpresa", "tipoConstituicao"), tipo, []string{"ltda", "slu"},
			"Informe o tipo de constituição")
	}
	for i, campo := range []struct {
		nome string
		val  *string
	}{
		{"nomeEmpresarial1", d.NomeEmpresarial1},
		{"nomeEmpresarial2", d.NomeEmpresarial2},
		{"nomeEmpresarial3", d.NomeEmpresarial3},
	} {
		if s, ok := v.obrigStr(p("dadosEmpresa", campo.nome), campo.val); ok {
			v.minLen(p("dadosEmpresa", campo.nome), s, 3,
				fmt.Sprintf("Informe a %dª opção (mín. 3 caracteres)", i+1))
		}
	}
	if s, ok := v.obrigStr(p("dadosEmpresa", "atividade"), d.Atividade); ok {
		v.minLen(p("dadosEmpresa", "atividade"), s, 20,
			"Descreva a atividade com mais detalhes (mín. 20 caracteres)")
	}
}

func validarEndereco(v *validador, e *enderecoForm) {
	if s, ok := v.obrigStr(p("endereco", "cep"), e.CEP); ok {
		v.matches(p("endereco", "cep"), s, reCEP, "CEP inválido")
	}
	if s, ok := v.obrigStr(p("endereco", "logradouro"), e.Logradouro); ok {
		v.minLen(p("endereco", "logradouro"), s, 2, "Logradouro inválido")
	}
	if s, ok := v.obrigStr(p("endereco", "numero"), e.Numero); ok {
		v.minLen(p("endereco", "numero"), s, 1, "Informe o número")
	}
	if s, ok := v.obrigStr(p("endereco", "bairro"), e.Bairro); ok {
		v.minLen(p("endereco", "bairro"), s, 2, "Bairro inválido")
	}
	if s, ok := v.obrigStr(p("endereco", "municipio"), e.Municipio); ok {
		v.minLen(p("endereco", "municipio"), s, 2, "Município inválido")
	}
	if s, ok := v.obrigStr(p("endereco", "estado"), e.Estado); ok {
		v.exatoLen(p("endereco", "estado"), s, 2, "Estado (UF) inválido")
	}
	if s, ok := v.obrigStr(p("endereco", "iptu"), e.IPTU); ok {
		v.minLen(p("endereco", "iptu"), s, 1, "Informe o nº do IPTU")
	}
	if e.ImovelAlugado == nil {
		v.addFatal(p("endereco", "imovelAlugado"), "Required")
	}
}

func validarDadosSocios(v *validador, d *dadosSociosForm) {
	if d.Socios == nil {
		v.addFatal(p("dadosSocios", "socios"), "Required")
		return
	}
	if len(*d.Socios) < 1 {
		v.add(p("dadosSocios", "socios"), "Adicione pelo menos 1 sócio")
	}
	for i := range *d.Socios {
		validarSocio(v, i, &(*d.Socios)[i])
	}
}

func validarSocio(v *validador, idx int, s *socioForm) {
	base := func(campo string) []any { return p("dadosSocios", "socios", idx, campo) }

	strRule := func(campo string, val *string, check func(string, []any)) {
		if x, ok := v.obrigStr(base(campo), val); ok {
			check(x, base(campo))
		}
	}

	strRule("nome", s.Nome, func(x string, path []any) { v.minLen(path, x, 3, "Informe o nome completo") })
	strRule("pis", s.PIS, func(x string, path []any) { v.matches(path, x, rePIS, "PIS inválido") })
	strRule("cpf", s.CPF, func(x string, path []any) { v.matches(path, x, reCPF, "CPF inválido") })
	strRule("rg", s.RG, func(x string, path []any) { v.minLen(path, x, 2, "Informe o RG e emissor") })
	strRule("nacionalidade", s.Nacionalidade, func(x string, path []any) { v.minLen(path, x, 3, "Informe a nacionalidade") })
	strRule("profissao", s.Profissao, func(x string, path []any) { v.minLen(path, x, 2, "Informe a profissão") })

	if s.ProLabore == nil {
		v.addFatal(base("proLabore"), "Required")
	} else if *s.ProLabore < 1412 {
		v.add(base("proLabore"), "O pró-labore mínimo é de 1 salário mínimo (R$ 1.412,00)")
	}

	strRule("telefoneCelular", s.TelefoneCelular, func(x string, path []any) {
		v.minLen(path, x, 14, "Telefone celular incompleto")
	})
	strRule("email", s.Email, func(x string, path []any) { v.matches(path, x, reEmail, "E-mail inválido") })
	strRule("estadoCivil", s.EstadoCivil, func(x string, path []any) {
		v.enum(path, x, estadosCivis, "Estado civil inválido")
	})
	strRule("nomeMae", s.NomeMae, func(x string, path []any) { v.minLen(path, x, 3, "Informe o nome da mãe") })
	strRule("cepRegistro", s.CEPRegistro, func(x string, path []any) { v.matches(path, x, reCEP, "CEP inválido") })
	strRule("logradouroRegistro", s.LogradouroRegistro, func(x string, path []any) { v.minLen(path, x, 2, "Informe o logradouro") })
	strRule("numeroRegistro", s.NumeroRegistro, func(x string, path []any) { v.minLen(path, x, 1, "Informe o número") })
	strRule("bairroRegistro", s.BairroRegistro, func(x string, path []any) { v.minLen(path, x, 2, "Informe o bairro") })

	if s.TeveParticipacaoSocietaria == nil {
		v.addFatal(base("teveParticipacaoSocietaria"), "Required")
	}
}

func validarSociedade(v *validador, s *sociedadeForm) {
	if s.CapitalSocial == nil {
		v.addFatal(p("sociedade", "capitalSocial"), "Required")
	} else if *s.CapitalSocial < 0.01 {
		v.add(p("sociedade", "capitalSocial"), "Informe um valor para o Capital Social")
	}

	if s.Quotas == nil {
		v.addFatal(p("sociedade", "quotas"), "Required")
	} else {
		for i := range *s.Quotas {
			validarQuota(v, i, &(*s.Quotas)[i])
		}
	}

	if tipo, ok := v.obrigStr(p("sociedade", "tipoAdministracao"), s.TipoAdministracao); ok {
		v.enum(p("sociedade", "tipoAdministracao"), tipo,
			[]string{"isoladamente", "conjunta", "outras"}, "Tipo de administração inválido")
	}
	if b, ok := v.obrigStr(p("sociedade", "banco"), s.Banco); ok {
		v.minLen(p("sociedade", "banco"), b, 2, "Informe o banco para a conta PJ")
	}
}

func validarQuota(v *validador, idx int, q *quotaForm) {
	if q.Percentual == nil {
		v.addFatal(p("sociedade", "quotas", idx, "percentual"), "Required")
	} else {
		if *q.Percentual < 0.01 {
			v.add(p("sociedade", "quotas", idx, "percentual"), "Min % é 0.01")
		}
		if *q.Percentual > 100 {
			v.add(p("sociedade", "quotas", idx, "percentual"), "Max % é 100")
		}
	}
	if q.IsAdministrador == nil {
		v.addFatal(p("sociedade", "quotas", idx, "isAdministrador"), "Required")
	}
}

// validarDocumentosAceitos: no modo full exige o booleano `true` (o `.refine`
// do Zod — erro "dirty", não aborta); no modo draft basta ser booleano.
func validarDocumentosAceitos(v *validador, raw json.RawMessage, required bool) {
	var b bool
	if err := json.Unmarshal(raw, &b); err != nil {
		v.addFatal(p("documentosAceitos"), "Required")
		return
	}
	if required && !b {
		v.add(p("documentosAceitos"), "Você precisa aceitar os termos de consentimento")
	}
}
