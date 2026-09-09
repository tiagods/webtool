# Guia de boas práticas de código

Estas regras orientam a criação de código legível, simples, testável e fácil de
manter. Aplique-as com bom senso e siga os padrões já adotados pelo projeto.

## Os 10 mandamentos

1. **Priorizarás a legibilidade**
	- Escreva código que conte uma história clara.
	- Prefira nomes descritivos a abreviações ou identificadores ambíguos como
	  `a`, `b` e `a1`.

2. **Não usarás nomes misteriosos**
	- Dê nomes claros a variáveis, funções, classes e módulos.
	- Use a terminologia do domínio da aplicação de forma consistente.

3. **Manterás as funções curtas e focadas**
	- Cada função deve ter uma única responsabilidade.
	- Evite funções com mais de 20 linhas ou com mais de três níveis de
	  indentação; extraia responsabilidades para funções menores e nomeadas.
	- Funções muito pequenas só devem existir quando seu nome agregar clareza.

4. **Não repetirás código (DRY)**
	- Extraia regras repetidas para funções, classes ou módulos reutilizáveis.
	- Evite criar abstrações prematuras; abstraia quando houver uma necessidade
	  real e clara.

5. **Escreverás testes automatizados**
	- Cubra comportamentos importantes, regras de negócio e cenários de erro.
	- Mantenha os testes determinísticos, legíveis e independentes.

6. **Comentarás apenas o porquê**
	- Faça o código explicar o que acontece por meio de nomes e estrutura.
	- Use comentários para registrar decisões, restrições ou regras não óbvias.
	- Comente de forma concisa e clara, evitando redundâncias, evite referencias que nao o codigo em si.
		- Evite comentários que descrevam o que o código já expressa claramente.
		- Evite comentarios completos de um fluxo de código, prefira explicar o porquê de uma decisão ou abordagem.
		- Evite referencias a outros arquivos ou documentações externas, prefira manter o contexto no próprio código.
		- Evite comentarios que expliquem demais um processo mesmo nao fazendo parte do fluxo de código, prefira explicar o porquê de uma decisão ou abordagem. (ex: main.go -> claramente ja invoca um Start, nao precisa comentar que o Start é invocado, mas sim explicar o porquê de invocar o Start naquele ponto do código)

7. **Tratarás erros de forma previsível**
	- Valide entradas e trate falhas nos limites apropriados.
	- Não ignore exceções nem deixe a aplicação falhar silenciosamente.
	- Retorne mensagens e estados que permitam diagnóstico e recuperação.

8. **Evitarás o excesso de complexidade**
	- Prefira soluções simples e diretas.
	- Evite funções com mais de cinco parâmetros; agrupe dados relacionados em
	  um objeto ou estrutura nomeada.
	- Reduza condicionais profundamente aninhadas usando retornos antecipados ou
	  extraindo regras para funções específicas.

9. **Manterás a consistência no padrão**
	- Siga a formatação, a nomenclatura, a arquitetura e as convenções do
	  projeto.
	- Evite valores fixos espalhados pelo código. Centralize configurações que
	  possam mudar, usando arquivos de configuração ou variáveis de ambiente
	  quando apropriado.

10. **Documentarás o essencial**
	 - Mantenha o `README` atualizado com configuração, execução e uso do
		projeto.
	 - Documente APIs públicas, decisões arquiteturais e requisitos relevantes.
