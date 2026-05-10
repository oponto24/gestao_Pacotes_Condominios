# Auditoria UX/UI 2026-05-10 — Padrão Apple, coeso, sem redundâncias

> ⏸️ **STATUS: AGUARDANDO** — Outro squad está mexendo em código nesta janela. **Não iniciar implementação até o squad atual fechar suas branches/PRs e mergear na main**, especialmente em arquivos do escopo abaixo:
> - `src/app/layout.tsx`
> - `src/app/(admin)/**`, `src/app/(portaria)/**`, `src/app/(administracao)/**`
> - `src/components/admin/AdminLayoutClient.tsx`, `AdminHeader.tsx`, `AdminSidebar.tsx`, `UserMenu.tsx`
> - `src/components/portaria/PortariaLayout.tsx`, `BottomNavBar.tsx`
> - `tailwind.config.ts`, `src/app/globals.css`
>
> **Antes de começar:** `git pull origin main` + checar PRs abertos do outro squad. Se algum PR tocar nos arquivos acima, esperar ele mergear primeiro pra evitar rebase trabalhoso.
>
> **Sequência sugerida:** 4 PRs separados (ver tabela "Plano sugerido" no fim do doc). Cada PR ataca um cluster temático — não misturar para reviews ficarem limpas.

**Objetivo:** levar o app a um padrão visual estilo Apple (HIG) — responsivo, consistente, hierarquia clara, zero redundância de chrome.

**Escopo lido:** layouts root/admin/portaria/administracao, AdminHeader, AdminSidebar, PortariaLayout, BottomNavBar, dashboard admin, UserMenu, design tokens (Tailwind + globals.css), UX_SPEC.

---

## Findings críticos (alto impacto visual)

### U1 — ALTA · Header duplicado em TODAS páginas autenticadas

**Arquivos:**
- `src/app/layout.tsx:47-54` — header global signed-in com `Logo` + `UserButton` Clerk
- `src/components/admin/AdminHeader.tsx:34-66` — segundo header com Building2/condomínio + breadcrumbs + UserMenu
- `src/components/portaria/PortariaLayout.tsx:36-60` — segundo header com condomínio/userNome + iniciais + LogOut

**Sintoma visual:** todo signed-in vê **2 barras horizontais empilhadas** (root header + group layout header). Em mobile, isso come 100–110px de viewport antes do conteúdo. Apple HIG recomenda **um único nav bar contextual** por contexto.

**Fix proposto:** matar header global do `app/layout.tsx` (linhas 47-54). Cada area (admin, portaria, super-admin) já tem seu chrome próprio. Logo + UserMenu ficam embutidos no chrome de cada área. Landing/sign-in continuam com header próprio dentro de seus components.

### U2 — ALTA · Logout/SignOut em 4 lugares simultâneos

**Arquivos:**
- `src/app/layout.tsx:51` — `<UserButton />` Clerk (popover com sign out)
- `src/components/admin/UserMenu.tsx:65-74` — botão "Sair" próprio
- `src/components/admin/AdminSidebar.tsx:175-183` — botão "Sair" no rodapé da sidebar
- `src/components/portaria/PortariaLayout.tsx:50-58` — ícone LogOut isolado no header

Quatro caminhos diferentes pra mesma ação, três designs visuais diferentes.

**Fix proposto:** unificar em **UserMenu único** (popover com avatar/iniciais → nome, email, role, "Sair"). Apenas no canto superior direito do chrome de cada área. Remover SignOut do AdminSidebar e do PortariaLayout header.

### U3 — ALTA · Rota `/administracao` sem chrome próprio (órfã)

**Arquivo:** `src/app/(administracao)/layout.tsx:22`

```tsx
return <div className="min-h-screen bg-background">{children}</div>;
```

Admin funcionário entra em `/administracao/em-transito` e fica **sem header, sem sidebar, sem nav**. Quebra coesão — comparado ao `/admin` que tem AdminHeader+Sidebar e `/portaria/*` que tem header+BottomNav.

**Fix proposto:** criar `AdministracaoLayoutClient` com header simplificado (só nome do condomínio + UserMenu) + nav lateral ou bottom-nav com 2-3 itens (Em trânsito, Organizar, Histórico). Reaproveitar tokens.

### U4 — ALTA · UX_SPEC totalmente desatualizada vs implementação

**Arquivo:** `docs/ux/UX_SPEC.md` linhas 41–67

```yaml
primary: '#2563EB'   # azul    ← spec
font_family: 'Inter, system-ui'   ← spec
```

vs realidade em `tailwind.config.ts:32-38` e `app/layout.tsx:9`:
```ts
primary: '#FDC800'  # amarelo Ponto24
font: Montserrat
```

Qualquer dev futuro que ler o UX_SPEC vai implementar o sistema errado. Doc é fonte de erro.

**Fix proposto:** sobrescrever UX_SPEC §2 com tokens reais (amarelo + Montserrat + acento violeta) ou marcar como "histórico — ver tailwind.config.ts".

---

## Findings padrão Apple (HIG)

### U5 — MÉDIA · Viewport bloqueia zoom — viola accessibility HIG

**Arquivo:** `src/app/layout.tsx:33-38`

```ts
viewport: { maximumScale: 1, userScalable: false }
```

Apple HIG explicitamente desencoraja `userScalable=no` em PWAs. Idoso/baixa visão fica preso. iOS Safari ignora em alguns casos, mas é red flag de auditoria.

**Fix:** remover `maximumScale` e `userScalable`. Manter `width=device-width, initialScale=1`.

### U6 — MÉDIA · Tipografia hierárquica fraca, longe do estilo Apple

Apple HIG usa **17pt corpo, 22pt subtítulo, 28-34pt título**, com `font-weight: 600` para destaques. Aqui a hierarquia atual é majoritariamente `text-sm` (14px) e `text-xs` (12px) com `text-2xl` para títulos:

- Dashboard: `text-2xl font-semibold` (24px) para "Olá, Admin"
- Cards KPI: `text-2xl` para valor mas `text-xs` para label — pulo grande demais
- Sidebar: tudo `text-sm` 14px, denso, sem respiração
- Header portaria: `text-xs uppercase tracking-wide` para condominio (Apple não usa CAPS)

**Fix proposto:** definir escala curta no Tailwind:
```
display:  32px / 600 / -0.02em
title:    24px / 600 / -0.01em
heading:  20px / 600
body:     17px / 400
caption:  13px / 500
```
Eliminar `text-xs uppercase tracking-wide` (não-Apple). Usar `caption` em sentence-case.

### U7 — MÉDIA · Bordas duras + cantos pequenos — visual "Bootstrap", não Apple

Apple HIG: cards em iOS/macOS usam `border-radius: 12-16px` + sombra suave + zero borda. Atual:

- `tailwind.config.ts:80-84`: `radius: { sm: 4, md: 8, lg: 12 }` — nada acima de 12
- `globals.css:14`: `--border: 220 13% 91%` (#E0E3E9) — borda **visível**, não translúcida
- `KpiCard` em `admin/page.tsx:170-181`: `rounded-lg border` (12px + borda dura)

**Fix proposto:**
- Aumentar `radius.lg` pra 14px e adicionar `radius.xl: 20px` pra cards principais.
- Trocar bordas por `shadow-[0_1px_2px_rgba(0,0,0,0.04)]` + `ring-1 ring-black/5` (Apple uses 1px hairline em luz).
- Cards sem hover de borda — usar leve elevação (`hover:shadow-md`).

### U8 — MÉDIA · `animate-pulse` no FAB — anti-HIG

**Arquivo:** `src/components/portaria/BottomNavBar.tsx:82`

```tsx
'animate-pulse bg-primary text-primary-foreground ring-4 ring-primary/40'
```

Pulsar continuamente cansa olho e quebra calma do iOS. HIG: animações são feedback de ação, não enfeite contínuo.

**Fix:** trocar pulse por uma micro-animação de "respiração" curta (ou nada). Usar `ring-2 ring-primary/20` estática para destacar que é o FAB primário.

### U9 — MÉDIA · `uppercase tracking-wide` espalhado — anti-HIG

Padrão Apple: títulos em **sentence case**, sem CAPS. Atual:

- `PortariaLayout:38` — `text-xs uppercase tracking-wide` no condomínio
- `admin/page.tsx:74,101` — `uppercase tracking-wide` em "Atalhos" e "Atividade recente"
- `BottomNavBar.tsx:86,103` — `uppercase tracking-wide` em labels da nav
- Ícones e badges: idem

**Fix:** remover `uppercase` de todos os section headers. Manter case natural com `text-sm font-semibold text-text-secondary`.

### U10 — BAIXA · Hover de cor em opacidade arbitrária

`hover:bg-primary-light/40` aparece em **8 lugares** (sidebar, header, links). Apple HIG não usa hover de cor em mobile; em desktop usa **fundo neutro 4-6% opacity** padrão.

**Fix:** definir token único `--surface-hover: rgba(0,0,0,0.04)` e usar `hover:bg-[var(--surface-hover)]` consistentemente.

---

## Findings de coesão / redundância

### U11 — MÉDIA · 2 ícones diferentes pra "Equipe" no AdminSidebar

**Arquivo:** `src/components/admin/AdminSidebar.tsx`

Linha 41 — `EQUIPE.icon = ShieldCheck`
Linha 45 — primeiro item da Equipe (Admins) também usa `ShieldCheck`

O grupo e o primeiro filho mostram o **mesmo ícone**. Visual confuso ao expandir.

**Fix:** trocar `ShieldCheck` do grupo por `Users2` ou similar, ou remover ícone do filho.

### U12 — BAIXA · Spacing inconsistente entre páginas

- Dashboard admin: `space-y-8`
- Portaria pages: variam entre `space-y-4` e `space-y-6`
- AdministracaoLayout: sem padding próprio

Sem ritmo vertical único, cada tela "respira" diferente.

**Fix:** estabelecer escala única `section-gap-md = 32px` para distância entre seções e padronizar via classe utility ou wrapper.

### U13 — BAIXA · `force-dynamic` + `runtime: nodejs` em todo layout

Boilerplate em `(admin)`, `(portaria)`, `(administracao)` layouts. Não é UX, é otimização — mas afeta tempo até primeira pintura. Considerar mover dynamic só onde necessário (páginas com data fresh).

### U14 — BAIXA · 3 padrões de "user identity"

- Root: `<UserButton />` Clerk com avatar do Clerk
- AdminHeader: `<UserMenu nome email />` próprio
- PortariaLayout: bolinha de iniciais render local + nome textual

Três avatares diferentes pro mesmo user. Apple resolveria com **um único componente Identity** parametrizável.

**Fix:** componente `<IdentityBadge size="sm|md" showName />` reutilizado em todos os chromes.

---

## Plano sugerido (ordem)

| # | Trabalho | Esforço | Impacto visual |
|---|---|---|---|
| 1 | U1 — remover header global, deixar chrome só nas áreas | 30min | Altíssimo — recupera 100px de viewport |
| 2 | U2 — unificar UserMenu + sair em 1 lugar por área | 1h | Alto |
| 3 | U3 — criar AdministracaoLayoutClient | 2h | Alto — fecha buraco do funcionário |
| 4 | U6 — escala tipográfica Apple no Tailwind + aplicar nas 3 áreas | 3h | Altíssimo |
| 5 | U7 — radius + shadow Apple, remover bordas duras | 2h | Alto |
| 6 | U9 — remover `uppercase tracking-wide` | 30min | Médio |
| 7 | U5 — viewport accessibility | 5min | Compliance |
| 8 | U8 — tirar animate-pulse do FAB | 10min | Médio |
| 9 | U10 + U11 + U12 + U14 — limpezas finais | 2h | Médio polish |
| 10 | U4 — atualizar UX_SPEC ou aposentar | 30min | Doc hygiene |

**Total ~12h dev** para um redesign Apple-like coeso, sem repensar IA. Sugiro 1 PR por bloco (U1+U2 juntos, U6+U7 juntos, etc.) pra reviews limpas.

---

## Não escopo desta auditoria

- Refazer fluxos (chegada/retirada/organizar) — só o chrome.
- Dark mode (`darkMode: ['class']` está no Tailwind mas não há `--background` dark token; tratar em story dedicada).
- Acessibilidade WCAG completa (focus states, ARIA, keyboard) — verificação parcial feita; auditoria dedicada vale a pena.
- Componentização da Landing (já tem polish próprio).

## Validação sugerida pós-fix

1. Abrir `/admin`, `/admin/pacotes`, `/portaria/pendentes`, `/chegada`, `/administracao/organizar` em iPhone SE simulator → conteúdo principal cabe acima da dobra.
2. Logout funciona e tem 1 caminho óbvio em cada área.
3. Lighthouse mobile ≥90 perf, ≥95 a11y.
4. Smoke visual com `npm run build && npm start` em desktop e mobile lado a lado pra ver coesão entre as 3 áreas.
