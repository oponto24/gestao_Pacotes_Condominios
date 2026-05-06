# Especificação UX/UI — Sistema de Gestão de Pacotes em Condomínios

> **Versão:** 1.0 (MVP)
> **Owner:** Uma (AIOX UX Design Expert)
> **Última atualização:** 2026-05-06
> **PRD:** `docs/prd/PRD.md` | **Arquitetura:** `docs/architecture/ARCHITECTURE.md` | **Schema:** `docs/architecture/database/SCHEMA.md`

---

## 1. Princípios de design

### 1.1 Princípios fundadores

1. **Mobile-first absoluto** — porteiro usa em pé, com uma mão, na portaria. Tudo que é importante cabe acima da dobra em tela 375px (iPhone SE).
2. **Botões grandes (mínimo 56px de altura)** — alvos de toque generosos, dedo grosso ou luva.
3. **Fluxo linear, sem ramificações invisíveis** — uma ação por vez, próximo passo sempre óbvio.
4. **Linguagem humana** — "Pacote chegou" e não "Registro criado". "Quem está retirando?" e não "Selecionar destinatário".
5. **Erros são oportunidades de ajuda** — nunca culpe o usuário; ofereça o caminho de recuperação.
6. **Feedback visual instantâneo** — toda ação tem resposta em <100ms (mesmo que seja "carregando...").
7. **Cores funcionais, não decorativas** — verde = sucesso/ok, amarelo = atenção, vermelho = bloqueio, azul = ação.

### 1.2 Persona-driven decisions

| Persona | Necessidade dominante | Implicação de design |
|---------|----------------------|----------------------|
| Porteiro | Velocidade + zero pensamento | Telas focadas, botão único principal por tela |
| Admin | Visão de conjunto + busca | Listas filtráveis densas, busca sempre visível |
| Morador | Receber e usar QR sem confusão | Mensagem WhatsApp curta e clara, QR grande |
| Super-admin (Gustavo) | Gerenciar SaaS | Painel separado, contexto explícito ao impersonar |

---

## 2. Design tokens (base inicial)

### 2.1 Cores

```yaml
# Brand
primary:        '#2563EB'  # azul ação principal (botões, links)
primary_dark:   '#1D4ED8'
primary_light:  '#DBEAFE'

# Semantic
success:        '#16A34A'  # verde — pacote retirado, status ok
success_light:  '#DCFCE7'
warning:        '#F59E0B'  # amarelo — pendência, atenção
warning_light:  '#FEF3C7'
danger:         '#DC2626'  # vermelho — erro, bloqueio
danger_light:   '#FEE2E2'
info:           '#0EA5E9'

# Neutral
background:     '#FFFFFF'
surface:        '#F9FAFB'  # cards
border:         '#E5E7EB'
text_primary:   '#111827'  # quase preto, alto contraste
text_secondary: '#6B7280'
text_muted:     '#9CA3AF'

# Status do pacote (cores semânticas)
status_rascunho:               '#6B7280'   # cinza
status_pendente_identificacao: '#F59E0B'   # amarelo
status_aguardando_retirada:    '#0EA5E9'   # azul info
status_retirado:               '#16A34A'   # verde
status_cancelado:              '#9CA3AF'   # cinza claro
```

**Contraste WCAG AA:** todas combinações de texto sobre fundo respeitam ≥4.5:1 (texto normal) e ≥3:1 (texto grande/UI).

### 2.2 Tipografia

```yaml
font_family:
  sans: 'Inter, system-ui, sans-serif'

font_size:
  xs:    '12px'
  sm:    '14px'
  base:  '16px'   # mínimo para corpo de texto (legibilidade mobile)
  lg:    '18px'
  xl:    '20px'
  '2xl': '24px'
  '3xl': '30px'
  '4xl': '36px'   # números grandes (apto, posição)

font_weight:
  normal:   400
  medium:   500
  semibold: 600
  bold:     700
```

### 2.3 Espaçamento (escala 4px)

```yaml
0:   0
1:   4px
2:   8px
3:   12px
4:   16px      # padding padrão de card
5:   20px
6:   24px      # espaçamento vertical entre seções
8:   32px
10:  40px
12:  48px
16:  64px
```

### 2.4 Componentes base (alturas)

```yaml
button_height:
  sm:  40px
  md:  48px
  lg:  56px      # botão principal mobile (alvo de toque generoso)

input_height:
  md:  48px      # padrão mobile
  lg:  56px

touch_target_min: 44px   # WCAG AAA recomendação
```

### 2.5 Border radius

```yaml
radius:
  sm:   4px
  md:   8px      # cards, inputs
  lg:   12px     # modais, botões grandes
  full: 9999px   # pills, badges
```

---

## 3. Atomic Design — inventário

### 3.1 Atoms (base components — shadcn/ui)
- `Button` (variants: primary, secondary, danger, ghost; sizes: sm/md/lg)
- `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`
- `Label`, `Badge`, `Avatar`
- `Spinner`, `Toast`
- `Card`, `Dialog`, `Sheet` (drawer mobile)

### 3.2 Molecules
- `FormField` = `Label` + `Input` + mensagem de erro
- `StatusBadge` (mapeia `PacoteStatus` → cor + ícone + texto)
- `BarcodeScannerInput` (câmera + input fallback)
- `PhotoCapture` (câmera + preview + retake)
- `ConfirmDialog` (cancelar/confirmar com semântica de risco)
- `EmptyState` (ícone + texto + CTA)
- `SearchBar` (input com clear + ícone)
- `MoradorCard` (nome + apto + telefone + badge "principal")
- `PacoteListItem` (resumo do pacote pra listas)

### 3.3 Organisms
- `AppHeader` (logo + nome do condomínio + menu usuário)
- `BottomNavBar` (4 ações principais para porteiro: Chegada / Retirada / Pendentes / Sair)
- `PacoteCard` (card detalhado de pacote)
- `PacoteTimeline` (eventos do pacote em ordem cronológica)
- `IAExtractionForm` (formulário de confirmação de dados extraídos)
- `FilterBar` (filtros do painel admin)
- `CSVImportWizard` (upload + preview + validação + commit)

### 3.4 Templates
- `PortariaLayout` (header + main + bottom nav)
- `AdminLayout` (sidebar + header + main)
- `SuperAdminLayout` (header + sidebar + impersonate banner)
- `AuthLayout` (centered card)

### 3.5 Pages
- 6 telas críticas detalhadas em §4.

---

## 4. Wireframes — 6 telas críticas

### 4.1 Tela: Chegada do pacote — Captura (PWA porteiro)

**Rota:** `/chegada`
**Persona:** Porteiro
**Objetivo:** Em <30s capturar foto e código → enviar pra IA processar.

```
┌─────────────────────────────────┐
│ 🏢 Edifício Aurora      👤  ⋯  │ ← Header (45px)
├─────────────────────────────────┤
│                                  │
│  📦 Novo pacote                  │ ← Título 2xl, bold, ml-4
│                                  │
│  ┌─────────────────────────┐    │
│  │                          │    │
│  │                          │    │
│  │      [VIEW CÂMERA]       │    │ ← Aspect ratio 4:3
│  │                          │    │   placeholder cinza com ícone
│  │     📷 Posicione a       │    │   câmera quando ativa
│  │        etiqueta aqui     │    │
│  │                          │    │
│  └─────────────────────────┘    │
│                                  │
│  ┌─────────────────────────┐    │
│  │   📷  TIRAR FOTO         │    │ ← Botão LG primary, full width, h-56px
│  └─────────────────────────┘    │
│                                  │
│  ┌─────────────────────────┐    │
│  │   📊  Bipar código       │    │ ← Botão LG ghost (opcional), h-56px
│  │      (opcional)          │    │
│  └─────────────────────────┘    │
│                                  │
│  ⓘ Foto é obrigatória. O bipe   │ ← Texto sm, text-secondary
│    ajuda a evitar duplicatas.   │
│                                  │
├─────────────────────────────────┤
│ 📦Chegada 📤Retirada ⏳Pend ⚙️ │ ← BottomNav (60px), aba ativa azul
└─────────────────────────────────┘
```

**Estados:**
- **Inicial:** câmera off, placeholder + 2 botões.
- **Câmera ativa:** preview ao vivo, botão "TIRAR FOTO" muda pra "📸 CAPTURAR" maior.
- **Foto capturada:** thumbnail + 2 botões "Refazer foto" (ghost) / "Continuar →" (primary).
- **Bipe ativo:** modal full-screen com scanner html5-qrcode, botão fechar (X).
- **Erro câmera:** estado com ícone alerta + texto + botão "Tentar novamente".

**Microinterações:**
- Click "TIRAR FOTO" → vibração leve (Vibration API) + flash visual.
- Captura → animação de zoom-in da thumbnail por 200ms.

---

### 4.2 Tela: Confirmar dados extraídos pela IA

**Rota:** `/chegada/confirmar/[pacoteId]`
**Persona:** Porteiro
**Objetivo:** Validar/corrigir o que a IA extraiu da foto antes de gravar.

```
┌─────────────────────────────────┐
│ ← Voltar      Confirmar dados   │ ← Header com back button
├─────────────────────────────────┤
│                                  │
│  ┌─────────────────────────┐    │
│  │  [thumbnail etiqueta]   │    │ ← Foto pequena clicável (zoom)
│  └─────────────────────────┘    │
│                                  │
│  IA identificou: 🟢 Confiança alta│ ← Badge verde/amarelo/vermelho
│                                  │
│  ┌─ Destinatário ────────────┐  │
│  │ Maria Silva              │  │ ← Input editável, h-48px
│  └────────────────────────────┘  │
│                                  │
│  ┌─ Apartamento ─────────────┐  │
│  │ 1304        Bloco: 3      │  │ ← 2 inputs lado a lado
│  └────────────────────────────┘  │
│                                  │
│  ┌─ CEP ──────────────────────┐  │
│  │ 74650-100                 │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌─ Transportadora ──────────┐  │
│  │ ▼ SuperFrete / Loggi      │  │ ← Select
│  └────────────────────────────┘  │
│                                  │
│  ✓ Encontrei: Apto 1304 Bl 3    │ ← Match badge verde
│    Maria Silva (cadastrada)     │
│                                  │
│  ┌─────────────────────────┐    │
│  │  ✓  CONFIRMAR E SEGUIR  │    │ ← Botão primary LG
│  └─────────────────────────┘    │
│                                  │
│  ┌─────────────────────────┐    │
│  │  📷  Trocar foto         │    │ ← Botão ghost
│  └─────────────────────────┘    │
└─────────────────────────────────┘
```

**Estados de match:**
- 🟢 **Match perfeito:** apto + nome cadastrados → mensagem verde, próximo passo direto.
- 🟡 **Match parcial:** apto cadastrado mas nome não → "Notificarei o condômino principal: João Silva. OK?"
- 🔴 **Sem match:** "Apartamento não encontrado. Quer cadastrar agora ou marcar como pendente?"

**Validações inline:**
- CEP formato `XXXXX-XXX`.
- Apartamento obrigatório.
- Nome destinatário obrigatório.

**Loading:** durante chamada IA inicial, tela mostra spinner + "Lendo etiqueta..." (~5s).

---

### 4.3 Tela: Organização — definir setor + tamanho

**Rota:** `/chegada/organizar/[pacoteId]`
**Persona:** Porteiro
**Objetivo:** Classificar tamanho e definir onde o pacote será guardado.

```
┌─────────────────────────────────┐
│ ← Voltar       Organizar         │
├─────────────────────────────────┤
│                                  │
│  Pacote para Maria Silva         │ ← Resumo do contexto
│  Apto 1304 Bl 3                  │
│                                  │
│  Tamanho:                        │
│  ┌──────┬──────┬──────┬──────┐  │
│  │  📦  │  📦  │  📦  │  📦  │  │ ← 4 cards toque, h-100px
│  │ peq. │ méd. │grande│ extra│  │   selecionado: border azul + bg light
│  └──────┴──────┴──────┴──────┘  │
│                                  │
│  Setor sugerido:                 │
│  ┌─────────────────────────┐    │
│  │ ✓ Armário Bloco A        │    │ ← Sugestão preenchida (verde)
│  └─────────────────────────┘    │
│  ↳ Trocar setor                  │ ← Link sm
│                                  │
│  Posição:                        │
│  ┌─────────────────────────┐    │
│  │ Ex: prateleira 3, B-12   │    │ ← Input livre
│  └─────────────────────────┘    │
│                                  │
│  ⚠️ Código de retirada ML        │ ← Banner amarelo, só se houver
│  Maria enviou:                   │
│  ┌─────────────────────────┐    │
│  │ 1234 — bola de futebol  │    │
│  └─────────────────────────┘    │
│                                  │
│  ┌─────────────────────────┐    │
│  │ 📤 NOTIFICAR MORADOR    │    │ ← Botão primary LG
│  └─────────────────────────┘    │
└─────────────────────────────────┘
```

**Estados:**
- **Sem código ML:** banner amarelo não aparece.
- **Múltiplos códigos ML:** lista com seleção (radio buttons).
- **Após confirmar:** loading "Enviando WhatsApp..." → toast de sucesso → volta pra tela inicial de chegada.

---

### 4.4 Tela: Retirada — Scan + confirmar

**Rota:** `/retirada`
**Persona:** Porteiro
**Objetivo:** Escanear QR Code do morador e registrar retirada em <15s.

```
┌─────────────────────────────────┐
│ 🏢 Edifício Aurora      👤  ⋯  │
├─────────────────────────────────┤
│                                  │
│  📤 Retirada                     │
│                                  │
│  ┌─────────────────────────┐    │
│  │                          │    │
│  │   ┌─────────────┐        │    │
│  │   │ ▮ ▮ ▮ ▮ ▮  │        │    │ ← Scanner ativo (overlay quadrado)
│  │   │ ▮         ▮ │        │    │
│  │   │ ▮  scan   ▮ │        │    │
│  │   │ ▮         ▮ │        │    │
│  │   │ ▮ ▮ ▮ ▮ ▮  │        │    │
│  │   └─────────────┘        │    │
│  │                          │    │
│  │  Aponte para o QR Code   │    │
│  │  do WhatsApp do morador  │    │
│  └─────────────────────────┘    │
│                                  │
│  ┌─────────────────────────┐    │
│  │  ⌨️  Digitar código      │    │ ← Fallback: input manual do token
│  └─────────────────────────┘    │
│                                  │
└─────────────────────────────────┘

Após scan bem-sucedido — modal/sheet sobe:

┌─────────────────────────────────┐
│  ┌──────────────────────────┐   │
│  │  [foto da etiqueta]      │   │
│  └──────────────────────────┘   │
│                                  │
│  📦 Pacote para:                 │
│  Maria Silva                     │
│  Apto 1304 Bl 3                  │
│                                  │
│  📍 Localização:                 │
│  Armário Bloco A — prat. 3       │
│                                  │
│  ⏱ Chegou em: 02/05 às 14:32     │
│                                  │
│  ──────────────────────────────  │
│                                  │
│  Quem está retirando?            │
│                                  │
│  ┌─────────────────────────┐    │
│  │ ●  A própria Maria       │    │ ← Radio principal (preselecionado)
│  └─────────────────────────┘    │
│                                  │
│  ┌─────────────────────────┐    │
│  │ ○  Outra pessoa          │    │
│  │   ┌──────────────────┐   │    │
│  │   │ Nome             │   │    │ ← Aparece quando selecionado
│  │   └──────────────────┘   │    │
│  └─────────────────────────┘    │
│                                  │
│  ┌─────────────────────────┐    │
│  │ ✓ CONFIRMAR ENTREGA     │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘
```

**Estados:**
- **QR já consumido:** alerta vermelho "Este QR já foi usado em DD/MM HH:MM por NOME". Sem retirada.
- **QR inválido:** "QR Code não reconhecido. Tente o scan de novo ou digite o código."
- **Sucesso:** toast verde "✅ Pacote entregue para Maria" → volta pra scanner.

---

### 4.5 Tela: Painel Admin — Lista de pacotes

**Rota:** `/admin/pacotes`
**Persona:** Admin / Síndico
**Objetivo:** Encontrar qualquer pacote em <10s e ver status geral.

```
┌────────────────────────────────────────────────────┐
│ 🏢 Edifício Aurora        Admin: Síndica  👤  ⋯  │
├────────────────────────────────────────────────────┤
│                                                     │
│  📦 Pacotes                                         │
│                                                     │
│  ┌──────────────────────────────────┐  [+ Novo]   │
│  │ 🔍 Buscar morador, apto, código  │              │
│  └──────────────────────────────────┘              │
│                                                     │
│  Filtros:                                           │
│  [Todos] [Aguardando 12] [Pendente ID 2] [Retirado] [Mês ▼]
│   ↑ ativo                                           │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🟡 Pendente ID                               │   │
│  │ Etiqueta sem match — 02/05 14:32             │   │
│  │ "MARCELO FERREIRA GOMES"                     │   │
│  │ → Resolver                                   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🔵 Aguardando retirada                       │   │
│  │ Maria Silva — Apto 1304 Bl 3                 │   │
│  │ Chegou 02/05 14:32 · Armário A — prat 3      │   │
│  │ 📤 WhatsApp entregue (lido 14:35)            │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🟢 Retirado                                  │   │
│  │ João Pereira — Apto 805                      │   │
│  │ Retirado 02/05 16:45 por Sandra (esposa)     │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ... mais 8 itens                                   │
│                                                     │
│         [ Carregar mais ]                           │
└────────────────────────────────────────────────────┘
```

**Estados:**
- **Vazio:** EmptyState com ilustração + "Nenhum pacote ainda" + botão "Importar moradores via CSV" se cadastros vazios.
- **Busca sem resultado:** "Nenhum pacote encontrado para 'xyz'. Tente outro termo."
- **Loading:** skeleton dos cards.

**Mobile:** mesma lista vira coluna única, badges de filtro viram horizontal scroll.

---

### 4.6 Tela: Detalhe do pacote

**Rota:** `/admin/pacotes/[id]`
**Persona:** Admin
**Objetivo:** Ver tudo sobre um pacote — auditoria completa.

```
┌────────────────────────────────────────────────────┐
│ ← Voltar    Pacote #4F2A...        🟢 Retirado    │
├────────────────────────────────────────────────────┤
│                                                     │
│  ┌────────────┐  Maria Silva                        │
│  │            │  Apto 1304 Bl 3                     │
│  │ [etiqueta] │  Telefone: (11) 9XXXX-XXXX          │
│  │   foto     │                                     │
│  │            │  Transportadora: SuperFrete         │
│  └────────────┘  Código: LG3INTKA2FNCI7LGP4YJ       │
│                  Tamanho: Médio                     │
│                  Local: Armário A — prat 3          │
│                                                     │
│  ──────────────────────────────────────             │
│                                                     │
│  📅 Timeline                                        │
│                                                     │
│  ●  02/05 14:32  Chegou na portaria                 │
│  │   Recebido por: Carlos (porteiro)                │
│  │   IA identificou destinatário ✓                  │
│  │                                                   │
│  ●  02/05 14:33  Notificação WhatsApp enviada       │
│  │   📤 Entregue · Lida 14:35                       │
│  │                                                   │
│  ●  02/05 16:45  Retirado                           │
│      Por: Sandra (esposa)                           │
│      Funcionário: Carlos                            │
│                                                     │
│  ──────────────────────────────────────             │
│                                                     │
│  🤖 Dados da IA (raw)                  [▼ expandir] │
│                                                     │
│  Ações:                                             │
│  [ Reenviar WhatsApp ] [ Ver foto ] [ Cancelar ]    │
│                                                     │
└────────────────────────────────────────────────────┘
```

**Ações por status:**
- `aguardando_retirada`: Reenviar WhatsApp, Cancelar pacote.
- `pendente_identificacao`: Resolver (modal escolhendo unidade/morador), Cancelar.
- `retirado`: somente visualização + Reenviar comprovante (futuro).

---

## 5. Telas secundárias (esboços rápidos)

### 5.1 Pendentes de identificação (`/portaria/pendentes`)
Lista filtrada igual painel admin, mas apenas status `pendente_identificacao` para o porteiro/admin resolver. CTA principal: "Resolver".

### 5.2 Cadastros (`/admin/unidades`, `/admin/moradores`, `/admin/setores`)
CRUD tabular padrão shadcn DataTable. Busca + filtros + paginação. Adicionar/editar via Sheet (drawer lateral mobile, modal desktop).

### 5.3 Importação CSV (`/admin/importar-csv`)
Wizard 3 passos:
1. **Upload** — drag-drop ou file picker. Mostra link "baixar template CSV" sempre.
2. **Preview** — tabela com primeiras 10 linhas + validação por linha (✓ / ⚠ / ✗). Mostra contadores: "98 ok, 2 com erro".
3. **Confirmar** — resumo + botão "Importar 98 unidades". Erros precisam ser corrigidos antes (download do CSV de erros).

### 5.4 Login (`/sign-in`)
Tela Clerk padrão (não desenhamos — Clerk fornece UI customizável via tokens).

### 5.5 Super-admin — lista de condomínios (`/super-admin/condominios`)
Tabela densa: nome, cidade, # unidades, # pacotes mês, status. CTA "Impersonar" → banner laranja persistente no topo "🔴 Você está vendo como [Condomínio]. [Sair]".

---

## 6. Mensagens WhatsApp — UX content

### 6.1 Template `pacote_chegou` (visual)

```
┌──────────────────────────────────┐
│ Sistema Pacotes              ✓✓  │
│                                   │
│ ┌─────────────────────────────┐  │
│ │                              │  │
│ │      [QR CODE PNG]           │  │
│ │       (300x300px)            │  │
│ │                              │  │
│ └─────────────────────────────┘  │
│                                   │
│ [Edifício Aurora] Olá Maria! 📦  │
│                                   │
│ Seu pacote chegou na              │
│ administração. Está em:           │
│ *Armário Bloco A, prateleira 3*.  │
│                                   │
│ Para retirar, apresente o QR      │
│ Code acima na portaria — pode     │
│ passar para outra pessoa retirar  │
│ por você se quiser.               │
│                                   │
│ Qualquer dúvida, responda esta    │
│ mensagem.                         │
│                          14:33    │
└──────────────────────────────────┘
```

**Princípios de copy:**
- Sempre prefixar com `[Nome do Condomínio]` (decisão de modelo número único multi-tenant).
- Saudação humana com nome.
- Localização em destaque (`*negrito*` no WhatsApp).
- Permissão explícita pra delegar retirada (reduz ansiedade).
- Convite a responder (abre janela de service grátis 24h).

---

## 7. Acessibilidade (WCAG AA)

### 7.1 Checklist obrigatório por componente
- [ ] Contraste texto/fundo ≥4.5:1 (texto normal) e ≥3:1 (texto grande/UI).
- [ ] Todo input tem `<label>` associado (Clerk + shadcn já tratam).
- [ ] Botões e links têm texto descritivo (não apenas ícone).
- [ ] Foco visível em todos elementos interativos (outline azul shadcn padrão).
- [ ] Ordem de tab lógica.
- [ ] Alvo de toque ≥44x44px (mobile).
- [ ] Imagens decorativas: `alt=""`. Imagens informativas: `alt="descrição"`.
- [ ] Erros anunciados via `aria-live="polite"`.

### 7.2 Concessões pragmáticas no MVP
- **Sem modo escuro** — adicionar pós-piloto se houver demanda.
- **Sem leitor de tela testado profundamente** — base shadcn é acessível, validar com NVDA/VoiceOver pós-MVP.

---

## 8. Comportamentos específicos do PWA

### 8.1 Instalável (Add to Home Screen)
- `manifest.json` com nome, ícone, splash, `display: standalone`.
- Ícone branded por condomínio? **Não no MVP** — ícone único do produto. (Premium futuro: white-label).

### 8.2 Permissões
- **Câmera:** solicitada na primeira visita a `/chegada` ou `/retirada`. Se negada, mostrar tela "Sem acesso à câmera. Vá em Configurações > Site > Permissões".
- **Notificações push:** **NÃO no MVP** (notificação acontece via WhatsApp, não push web).

### 8.3 Offline
- **Não suportado no MVP** — operação é sempre online. Mensagem clara se conexão cair: "Sem internet. Suas ações não serão salvas até reconectar."

---

## 9. Estado vazio e estados de erro (consistência)

### 9.1 Empty states padrão

| Tela | Ilustração | Mensagem | CTA |
|------|-----------|----------|-----|
| Lista pacotes vazia | 📦 grande | "Nenhum pacote ainda. Quando registrar o primeiro, ele aparece aqui." | — |
| Cadastros sem unidades | 🏠 grande | "Comece importando suas unidades de uma vez via CSV." | "Importar CSV" |
| Pendentes vazia | ✅ grande | "Tudo em dia! Sem pendências de identificação." | — |
| Busca sem resultado | 🔍 grande | "Nada encontrado para '{termo}'. Tente outro termo." | "Limpar busca" |

### 9.2 Erros padrão

| Tipo | Apresentação | Recuperação |
|------|-------------|-------------|
| Network/timeout | Toast vermelho + ícone wifi-off | "Tentar novamente" |
| 4xx aplicacional | Inline na tela com mensagem específica | Botão de correção |
| 5xx servidor | Tela full com "Ops! Algo deu errado." + ID do erro | "Tentar de novo" / "Voltar" |
| Permissão negada | Modal com instrução passo-a-passo | "Abrir configurações" |

---

## 10. Próximos passos

1. **`@dev` (Dex):** implementar shadcn/ui + tokens em `tailwind.config.ts` baseado nesta spec.
2. **`@dev`:** começar pelos atoms → molecules → organisms → telas, na ordem do PRD (E1 → E2 → E3...).
3. **Eu (Uma) volto** quando precisar:
   - Wireframes de telas pós-MVP (dashboard, relatórios).
   - Validação de acessibilidade real com NVDA/VoiceOver.
   - White-label dos PWAs por condomínio (feature premium).
   - Pesquisa qualitativa pós-piloto (NPS porteiro/admin).

---

## 11. Backlog de melhorias UX pós-MVP

- Modo escuro (dark mode) — toggle no perfil.
- Notificações push web (PWA) para admin (alertas de pendências).
- Atalhos de teclado no painel admin (busca rápida `/`, navegar setas).
- Drag-and-drop de pacotes pra setores no painel admin.
- Avatares dos moradores (foto opcional) → reconhecimento visual mais rápido.
- Animações de transição entre telas (Framer Motion) — adiciona deleite sem custo de performance.
- Histórico de mensagens WhatsApp por morador no painel admin (timeline completa).
- Export PDF do detalhe do pacote (comprovante imprimível).
