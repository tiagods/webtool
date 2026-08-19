# Design System — Prolink Contábil

Extraído diretamente do site prolinkcontabil.com.br (Framer). Usar como referência para implementação com shadcn/ui + Tailwind.

---

## Cores

```ts
// tailwind.config.ts
colors: {
  brand:      '#05354C',  // Navy — headers, títulos, footer
  accent:     '#0099FF',  // Azul — CTAs, foco de input, stepper ativo
  sky:        '#6CBCDA',  // Azul claro — badges informativos, destaques
  success:    '#16a34a',  // Verde — step concluído, arquivo enviado
  error:      '#DC2626',  // Vermelho — erros, campos obrigatórios
  text:       '#1C1C1C',  // Texto principal
  textAlt:    '#28282B',  // Labels
  muted:      '#999999',  // Placeholders, labels secundários
  border:     '#E5E5E8',  // Bordas de inputs e cards
  surface:    '#FFFFFF',  // Cards, inputs
  surfaceAlt: '#F9F9F9',  // Background de página, headers de card
  warm:       '#FCFCFA',  // Inputs não-focados
}
```

---

## Tipografia

```ts
// tailwind.config.ts
fontFamily: {
  sans:    ['Inter', 'sans-serif'],
  display: ['Inter Display', 'Inter', 'sans-serif'],
}
```

| Uso | Fonte | Tamanho | Peso |
|---|---|---|---|
| Título de página | Inter Display | 26px | 700 |
| Título de card | Inter Display | 14px | 600 |
| Label de campo | Inter | 12px | 500 |
| Valor / body | Inter | 13–14px | 400–500 |
| Helper text | Inter | 11–12px | 400 |
| Badge / chip | Inter | 11–12px | 500 |

---

## Componentes

### Input

```tsx
// Estado normal
className="h-11 rounded-lg border border-border bg-warm px-3.5 text-sm
           placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent"

// Estado erro
className="border-error focus:border-error focus:ring-error"

// Auto-preenchido (CEP)
className="bg-surfaceAlt text-text cursor-not-allowed"
```

### Textarea

```tsx
className="min-h-[88px] rounded-lg border border-border bg-warm px-3.5 py-3
           text-sm placeholder:text-muted resize-none
           focus:border-accent focus:ring-1 focus:ring-accent"
```

### RadioCard (seleção de tipo)

```tsx
// Selecionado
className="border-2 border-accent bg-accent/5 rounded-xl p-5 cursor-pointer"

// Normal
className="border border-border bg-warm rounded-xl p-5 cursor-pointer
           hover:border-accent/40 transition-colors"
```

### RadioChip (estado civil)

```tsx
// Selecionado
className="h-9 px-4 rounded-lg border-2 border-accent text-accent text-sm font-medium"

// Normal
className="h-9 px-4 rounded-lg border border-border bg-warm text-muted text-sm
           hover:border-accent/40 transition-colors cursor-pointer"
```

### Botão Primário

```tsx
className="h-11 px-7 bg-accent text-white text-sm font-semibold rounded-lg
           hover:bg-accent/90 transition-colors"
```

### Botão Secundário (outline)

```tsx
className="h-11 px-6 border border-border bg-white text-muted text-sm font-medium
           rounded-lg hover:border-brand/30 transition-colors"
```

### Card de seção

```tsx
className="bg-white border border-border rounded-xl p-7"
```

### Badge de status

```tsx
// Opcional
className="text-[11px] font-medium text-sky bg-sky/10 rounded px-2 py-0.5"

// Obrigatório
className="text-[11px] font-medium text-error bg-error/7 rounded px-2 py-0.5"

// Enviado
className="text-[11px] font-medium text-success bg-success/10 rounded px-2 py-0.5"

// Pendente
className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5"
```

### Acento de seção (barra azul)

```tsx
<div className="w-1 h-5 bg-accent rounded-sm" />
```

---

## Stepper

```tsx
// Concluído
<div className="w-7 h-7 rounded-full bg-success flex items-center justify-center">
  <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
</div>

// Ativo
<div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center">
  <span className="text-[12px] font-bold text-white">{step}</span>
</div>

// Pendente
<div className="w-7 h-7 rounded-full bg-border flex items-center justify-center">
  <span className="text-[12px] font-semibold text-muted">{step}</span>
</div>

// Linha conectora concluída
<div className="w-12 h-0.5 bg-success mx-3" />

// Linha conectora pendente
<div className="w-12 h-0.5 bg-border mx-3" />
```

---

## Upload Field

```tsx
// Pendente — dashed
className="border-2 border-dashed border-border rounded-xl p-5 bg-warm
           flex flex-col items-center gap-2.5 hover:border-accent/50 transition-colors"

// Enviado — dashed verde
className="border-2 border-dashed border-success/50 rounded-xl p-5 bg-success/5
           flex flex-col items-center gap-2.5"
```

---

## Espaçamento

| Contexto | Mobile | Tablet (md) | Desktop (lg) |
|---|---|---|---|
| Padding de página (lateral) | `16px` | `32px` | `80px` |
| Largura da coluna do form | `100%` | `100%` | `760px` |
| Gap entre cards de seção | `12px` | `16px` | `16px` |
| Padding interno de card | `16px` | `20px 24px` | `28px 32px` |
| Gap entre campos | `12px` | `16px` | `16px` |
| Gap entre grupos de campos | `8px` | `12px` | `12px` |
| Border-radius de card | `12px` | `12px` | `12px` |
| Border-radius de input | `8px` | `8px` | `8px` |

---

## Responsividade

> **Regra absoluta**: toda a interface web DEVE ser totalmente responsiva. Mobile-first, com adaptações progressivas para tablet e desktop.

### Breakpoints (Tailwind padrão)

| Breakpoint | Mínimo | Uso |
|---|---|---|
| Default | `0px` | Mobile (base) |
| `sm` | `640px` | Mobile largo / phablet |
| `md` | `768px` | Tablet |
| `lg` | `1024px` | Desktop |
| `xl` | `1280px` | Desktop largo |

### Regras por componente

| Componente | Mobile | Desktop |
|---|---|---|
| **Stepper** | Ocultar labels, mostrar só números + step ativo como texto | Layout horizontal completo |
| **Form columns** | Stack vertical (1 coluna) | Side-by-side (2–3 colunas) |
| **RadioCard** | Stack vertical, full-width | Side-by-side (2 cards) |
| **RadioChip** | Wrap / `flex-wrap` | Inline row |
| **Card de seção** | Padding reduzido, sem border-radius nos extremos | Padding completo, rounded-xl |
| **Buttons (footer)** | Stack vertical ou full-width | Inline com gap |
| **Upload field** | Full-width, compact | Largura proporcional |
| **Título de página** | `24px` | `32px` |
| **Badge** | Mesmos estilos | Mesmos estilos |

### Padrões de layout

```tsx
// Coluna do formulário — responsiva
className="w-full max-w-[760px] mx-auto px-4 md:px-8 lg:px-0"

// 2 colunas → 1 em mobile
className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4"

// 3 colunas → 1 em mobile
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4"

// Card responsivo
className="bg-white border border-border rounded-xl p-4 md:p-5 lg:p-7"

// Stepper — mobile mostra só step ativo
className="hidden md:flex"  // labels
className="flex md:hidden"  // versão compacta mobile
```

### Testar em

- iPhone SE (375px)
- iPhone 14 (390px)
- iPad (768px)
- Desktop (1440px)

---

## Integrações de UX

| Padrão | Implementação |
|---|---|
| CEP auto-fill | `onBlur` → `GET viacep.com.br` → preencher e desabilitar campos |
| Máscaras | `react-imask`: CPF, CNPJ, CEP, telefone, PIS |
| Validação | `react-hook-form` com `zodResolver`, mensagens inline abaixo do campo |
| Upload drag & drop | `react-dropzone` + preview de arquivo enviado |
| Persistência de rascunho | `localStorage` entre steps + debounce 1s |
| Dots de progresso | 5 pontos coloridos no rodapé: verde (concluído) / azul (ativo) / cinza (pendente) |
