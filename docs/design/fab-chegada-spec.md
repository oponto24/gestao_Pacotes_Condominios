# FAB Chegada — Spec de redesign

**Autora:** Uma (UX-Design Expert)
**Aprovado por:** user · 2026-05-11
**Mockup visual:** [`fab-chegada-mockup.html`](./fab-chegada-mockup.html)

## Objetivo

Consolidar 3 botões em **1 FAB único** que muda de função progressivamente, eliminando o pulo de olho do porteiro entre topo da tela e bottom nav durante a captura de etiqueta.

## State machine do FAB

| State | Trigger | Label | Ícone | Variante visual | Comportamento |
|---|---|---|---|---|---|
| `idle-route` | qualquer rota da portaria ≠ `/chegada` | **Chegada** | `Camera` | `default` (gradiente azul) | `<Link href="/chegada">` |
| `idle-page` | `/chegada`, sem câmera ligada | **Abrir câmera** | `Camera` | `action` (gradiente intenso + halo pulse) | dispara `PhotoCapture.start()` |
| `streaming` | câmera ligada via `getUserMedia` | (sem texto) | `Aperture` shutter | `capture` (branco + outline ring) | dispara `PhotoCapture.capture()` |
| `captured` | blob gerado | **Usar foto** | `Check` | `success` (gradiente verde) | dispara `onCapture(blob, dataUrl)` |
| `submitting` | POST `/api/pacotes` rolando | **Enviando…** | spinner | `disabled` (default + opacity 0.55) | nenhum (disabled) |

## Tokens propostos (`globals.css`)

```css
:root {
  --fab-default-from: oklch(0.58 0.18 255);
  --fab-default-to:   oklch(0.48 0.22 265);
  --fab-action-from:  oklch(0.62 0.21 250);
  --fab-action-to:    oklch(0.42 0.24 260);
  --fab-capture:      oklch(0.98 0 0);
  --fab-success-from: oklch(0.65 0.18 145);
  --fab-success-to:   oklch(0.50 0.21 150);
  --fab-glow:         oklch(0.58 0.18 255 / 0.40);
  --fab-glow-success: oklch(0.65 0.18 145 / 0.40);
}
```

WCAG AA validado: contraste mínimo 5.8:1 em todas as variantes.

## Microinterações

- **Press**: `scale(0.93)` em `:active`, transição 120ms ease-out.
- **Halo pulse**: só na variante `action` — animação `halo` 2.6s ease-in-out infinite, expandindo box-shadow externa.
- **Capture haptics**: `vibrate(50)` ao capturar (já existe), `vibrate([20,40,20])` ao entrar em `captured`.
- **Crossfade**: `transition: background, box-shadow 300ms ease-out` entre estados.

## Refazer foto

Link textual `↻ Refazer foto` acima do visor, visível apenas nos estados `captured` e `submitting` (inerte em submitting). Cor `--fab-default-from`, underline. **Não usar long-press no FAB** (gesture invisível, rejeitado pelo user).

## Refactor arquitetural

### `BottomNavContext.tsx`
Trocar `variant: 'primary' | 'success'` por `state: FabState` onde:
```ts
export type FabState = 'idle-route' | 'idle-page' | 'streaming' | 'captured' | 'submitting';

export interface FabOverride {
  state: FabState;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  ariaLabel?: string;
  disabled?: boolean;
}
```

### `BottomNavBar.tsx`
Lookup `state → className` via mapa, não if-else. Mantém `<Link>` para o caso `idle-route` (sem override) e `<button>` para todos os outros.

### `PhotoCapture.tsx`
Vira **controlled component**. Remove os botões internos:
- `state === 'idle'` — sem botão (FAB do bottom nav cobre via `useBottomNavOverride`)
- `state === 'streaming'` — sem botão (idem)
- `state === 'captured'` — sem botão (idem)
- `state === 'error'` — mantém botão interno "Tentar novamente" (estado terminal local)

Expõe handlers via prop `onStateChange(state)` para o pai dirigir o FAB.

### `CapturaPageClient.tsx`
Fonte da verdade. Lê `state.kind` do PhotoCapture via callback e dispara `useBottomNavOverride({ state: mapToFabState(state.kind), ... })`. Adiciona link "Refazer foto" acima do visor quando aplicável.

## Plano de implementação — 4 PRs

| PR | Escopo | Risco | Reversível? |
|---|---|---|---|
| **PR-1 Tokens** | Adiciona variáveis OKLCH em `globals.css` + tipo `FabState` em `BottomNavContext` | Zero | Sim |
| **PR-2 Visuals** | Aplica gradientes/shadows novos em `BottomNavBar` mantendo state machine antiga (`variant`). Visual upgrade isolado | Baixo (só CSS) | Sim |
| **PR-3 State machine** | Refatora `PhotoCapture` → controlled. Drives FAB do `CapturaPageClient`. Remove botões in-page. Adiciona link "Refazer foto" | Médio (mudança comportamental) | Sim, mas requer smoke E2E |
| **PR-4 Microinterações** | scale-on-press, haptics duplo, crossfade entre estados | Zero | Sim |

Cada PR isolado, mergeável independente, smoke test rápido entre cada um.

## Acessibilidade

- Touch target 64×64px (≥ NFR-050) ✅
- `aria-label` dinâmico matching `state.label`
- `aria-busy="true"` no estado `submitting`
- Região `aria-live="polite"` acima do visor anuncia transições ("Câmera aberta", "Foto capturada", "Enviando")
- Foco visível via `ring-offset-2 ring-offset-background` (porteiro com luva → caneta capacitiva)

## Não-objetivos

- Não muda o fluxo de upload (`uploadPacote`) — só o que o porteiro vê
- Não muda paleta global do app — só tokens novos `--fab-*`
- Não mexe na bottom nav lateral (Pendentes / Retirada) — só no FAB central
- Não mexe em `/retirada` ou `/portaria/pendentes` — fora de escopo

## Referências

- Mockup interativo: `docs/design/fab-chegada-mockup.html`
- Apple HIG (achado UX U8 anterior): pulse infinito cansa em estado neutro, OK em estado de ação iminente
- Componente atual: `src/components/portaria/BottomNavBar.tsx`, `PhotoCapture.tsx`, `CapturaPageClient.tsx`, `BottomNavContext.tsx`
