# Página Inicial — Seleção de Ficha

Tela de entrada da Ficha Cadastral Digital. Apresenta as duas opções de ficha disponíveis e direciona o usuário para o fluxo correspondente.

---

## Protótipo

Design no Paper:
**[Abrir no Paper →](https://app.paper.design/file/01KP10MY4NWSR343R7HKDZ3KWA/4-0)**

---

## Layout

Tela centralizada com dois cards de seleção lado a lado:

| Card | Label | Destino |
|---|---|---|
| Ficha Cadastral de Abertura | `ABERTURA` | Fluxo de abertura — [ficha-abertura.md](./ficha-abertura.md) |
| Ficha Cadastral de Alteração | `ALTERAÇÃO` | Fluxo de alteração — [ficha-alteracao.md](./ficha-alteracao.md) |

### Card de Abertura

- Ícone: casa (abertura de empresa)
- Descrição: "Registre uma nova empresa com todo o amparo jurídico e contábil. Preencha os dados em 6 passos simples."
- Rodapé: `6 passos · ~10 min`
- CTA primário: **Iniciar Abertura →**

### Card de Alteração

- Ícone: lápis/edição (alteração contratual)
- Descrição: "Solicite alterações nos dados cadastrais de uma empresa já existente. Rápido, seguro e sem burocracia."
- Rodapé: `Processo simplificado`
- CTA secundário (outline): **Iniciar Alteração →**

---

## Navegação

```
/ (raiz ou /ficha)
  ├── /abertura   → Ficha de Abertura (Passo 1)
  └── /alteracao  → Ficha de Alteração (Passo 1)
```

---

## Comportamento

- Nenhum dado é carregado nesta tela — é puramente navegacional.
- Ao clicar em qualquer card, cria-se uma nova sessão de formulário e redireciona para o Passo 1 do fluxo correspondente.
