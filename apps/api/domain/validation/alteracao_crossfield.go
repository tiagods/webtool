package validation

import "fmt"

// Regras condicionais da Ficha de Alteração (os `superRefine` de alteracao.ts).
// Cada função abaixo é pura e testável isoladamente; os validadores de bloco em
// alteracao.go as chamam e mapeiam cada `false` para a issue no caminho correto.
//
// Espelham exatamente a semântica do Zod:
//   Q04 — cnpjAnterior obrigatório quando o membro declarou participação anterior
//   Q05 — valorIntegralizacao + especificarIntegralizacao obrigatórios no aumento
//   Q07 — especificar obrigatório quando a transformação é "outras"
//   master — cada quadro selecionado em `quadros[]` exige o bloco `qNN` preenchido

// cnpjAnteriorInformado: false quando o membro declarou participação societária
// anterior ("sim") mas não informou o CNPJ (nil ou vazio — mesma falsidade do
// `!membro.cnpjAnterior` do Zod).
func cnpjAnteriorInformado(participacaoAnterior, cnpjAnterior string) bool {
	return participacaoAnterior != "sim" || cnpjAnterior != ""
}

// exigeIntegralizacao: true quando a alteração de capital é um aumento — nesse
// caso valorIntegralizacao e especificarIntegralizacao passam a ser obrigatórios.
func exigeIntegralizacao(tipoAlteracao string) bool {
	return tipoAlteracao == "aumento"
}

// especificarTransformacaoInformado: false quando a transformação é "outras" e o
// campo de especificação ficou vazio (nil ou "" — falsidade do `!data.especificar`).
func especificarTransformacaoInformado(tipoTransformacao, especificar string) bool {
	return tipoTransformacao != "outras" || especificar != ""
}

// validarCrossQuadros roda o `superRefine` de alteracaoFormSchema: para cada
// quadro selecionado, exige o bloco `qNN` correspondente presente no payload.
// Só é chamado quando não houve erro "aborted" no parse (identificacao/quadros/
// aceite/qNN válidos), espelhando o merge de objeto do Zod.
func validarCrossQuadros(v *validador, quadros []string, blocoPresente map[string]bool) {
	for _, codigo := range quadros {
		chave, ok := quadroParaChave[codigo]
		if !ok {
			continue // quadro desconhecido já gerou issue "aborted" no parse
		}
		if !blocoPresente[chave] {
			v.add(p(chave), fmt.Sprintf("Preencha os dados do quadro selecionado (%s)", codigo))
		}
	}
}
