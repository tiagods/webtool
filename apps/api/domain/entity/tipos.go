// Package entity contém os tipos de domínio da API — structs e enumerações que
// não dependem de nenhum framework, SDK ou detalhe de infraestrutura.
package entity

// TipoConstituicao identifica a natureza jurídica da sociedade sendo constituída
// ou alterada. É denormalizado no item de rascunho para roteamento no worker.
type TipoConstituicao string

// Valores reconhecidos de TipoConstituicao.
const (
	TipoLtda TipoConstituicao = "ltda"
	TipoSLU  TipoConstituicao = "slu"
)

// Valido informa se t é um TipoConstituicao reconhecido.
func (t TipoConstituicao) Valido() bool {
	return t == TipoLtda || t == TipoSLU
}

// FormType distingue os dois formulários que compartilham o mesmo fluxo de
// backend: abertura de empresa e alteração contratual.
type FormType string

// Valores reconhecidos de FormType.
const (
	FormAbertura  FormType = "abertura"
	FormAlteracao FormType = "alteracao"
)

// Valido informa se f é um FormType reconhecido.
func (f FormType) Valido() bool {
	return f == FormAbertura || f == FormAlteracao
}

// RascunhoStatus é o estágio do rascunho no ciclo de vida da sessão. A transição
// para StatusEnviado é irreversível e feita num único UpdateItem que também zera
// os dados sensíveis (ver RascunhoRepository.MarcarEnviado).
type RascunhoStatus string

// Valores reconhecidos de RascunhoStatus.
const (
	StatusRascunho RascunhoStatus = "rascunho"
	StatusEnviado  RascunhoStatus = "enviado"
)

// Valido informa se s é um RascunhoStatus reconhecido.
func (s RascunhoStatus) Valido() bool {
	return s == StatusRascunho || s == StatusEnviado
}
