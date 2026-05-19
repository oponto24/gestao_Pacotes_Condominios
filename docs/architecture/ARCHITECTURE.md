# Arquitetura Técnica — Sistema de Gestão de Pacotes em Condomínios

> **Versão:** 2.0 (pós-Epic 12)
> **Status:** Em produção — MVP + Epics 7-12 parciais
> **Owner:** Aria (AIOX Architect)
> **Última atualização:** 2026-05-19
> **PRD de referência:** `docs/prd/PRD.md`

---

## 1. Visão geral arquitetural

Sistema **multi-tenant SaaS** para gestão de pacotes em condomínios, com 3 superfícies de uso:

- **PWA Portaria/Admin** (mobile-first) — usado pelo porteiro e síndico.
- **Webhook receiver** — recebe eventos do WhatsApp Cloud API (Meta).
- **Background workers** — processam fotos com IA, enviam mensagens, retentam falhas.

### 1.1 Princípios arquiteturais (do macro ao micro)

1. **Boring tech first** — Next.js, PostgreSQL, Redis. Nada experimental.
2. **Defesa em profundidade** — multi-tenancy isolado em 2 camadas (middleware + RLS).
3. **Tudo é evento** — cada ação no pacote gera registro imutável de auditoria.
4. **Async por padrão** — operações lentas (IA, WhatsApp, fotos) vão pra fila.
5. **Caminho de evolução documentado** — todo trade-off pragmático tem nota de "como migrar quando crescer".
6. **Observabilidade desde o dia 1** — logs estruturados + métricas básicas + alertas críticos.

### 1.2 Diagrama de componentes

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USUÁRIOS                                        │
│  📱 Porteiro/Admin (PWA)    💬 Morador (WhatsApp)    🛠️ Super-admin     │
└────────────────┬─────────────────┬──────────────────────┬───────────────┘
                 │ HTTPS           │ Webhook              │ HTTPS
                 ▼                 ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CADDY (reverse proxy + Let's Encrypt)                 │
└────────────────┬────────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  NEXT.JS 16 APP (App Router)                             │
│  ┌──────────────────┐  ┌─────────────────┐  ┌────────────────────────┐ │
│  │  PWA Frontend    │  │  API Routes     │  │  Webhook Handlers      │ │
│  │  (RSC + Client)  │  │  (REST + Server │  │  (Meta WhatsApp)       │ │
│  │                  │  │   Actions)      │  │                        │ │
│  └──────────────────┘  └─────────────────┘  └────────────────────────┘ │
│           │                    │                      │                  │
│           └────────────────────┼──────────────────────┘                 │
│                                ▼                                         │
│                ┌────────────────────────────────┐                       │
│                │   Clerk Middleware (auth)      │                       │
│                │   Tenant Middleware (cond_id)  │                       │
│                └────────────────────────────────┘                       │
└──────────────────────────┬───────────────────────┬──────────────────────┘
                           │ Prisma                │ BullMQ enqueue
                           ▼                       ▼
        ┌──────────────────────────┐    ┌──────────────────────────┐
        │   PostgreSQL 16          │    │   Redis 7                │
        │   - schema com RLS       │    │   - BullMQ queues        │
        │   - condominio_id em PK  │    │   - cache de sessão      │
        │   - migrations Prisma    │    │                          │
        └──────────────────────────┘    └──────────┬───────────────┘
                                                   │ consume
                                                   ▼
        ┌─────────────────────────────────────────────────────────┐
        │           NODE.JS WORKER (mesmo repo, processo separado) │
        │  ┌─────────────────┐  ┌──────────────────┐  ┌────────┐ │
        │  │ extract-label   │  │ send-whatsapp    │  │ retry  │ │
        │  │ (Anthropic API) │  │ (Meta Cloud API) │  │ jobs   │ │
        │  └─────────────────┘  └──────────────────┘  └────────┘ │
        └────────────────┬───────────────┬─────────────────────────┘
                         │               │
                         ▼               ▼
              ┌───────────────────┐  ┌──────────────────────┐
              │ Anthropic API     │  │ Meta WhatsApp Cloud  │
              │ Claude Haiku 4.5  │  │ API (graph.facebook  │
              │ vision + cache    │  │ .com/v21.0/...)      │
              └───────────────────┘  └──────────────────────┘

        ┌──────────────────────────┐
        │  STORAGE                  │
        │  - Volume Docker local    │  ← MVP (rateado por VPS)
        │  - MinIO (futuro)         │  ← quando crescer
        └──────────────────────────┘
```

---

## 2. Stack técnica completa

### 2.1 Frontend
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Next.js | 16.x (App Router) | Framework React fullstack |
| React | 19.x | UI library |
| TypeScript | 5.x | Type safety end-to-end |
| Tailwind CSS | 4.x | Styling utility-first |
| shadcn/ui | latest | Componentes acessíveis prontos |
| html5-qrcode | latest | Leitura de QR/barcode pela câmera |
| qrcode | latest | Geração de QR para WhatsApp |
| react-hook-form + zod | latest | Forms + validação |
| @clerk/nextjs | latest | Autenticação |

### 2.2 Backend
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Node.js | 22 LTS | Runtime |
| Next.js Route Handlers | 16.x | API REST |
| Server Actions | 16.x | Mutations from RSC |
| Prisma | 6.x | ORM PostgreSQL |
| BullMQ | 5.x | Job queue |
| Pino | 9.x | Logging estruturado |
| @anthropic-ai/sdk | latest | Cliente Claude com vision |
| undici / node-fetch | nativo | HTTP para Meta API |

### 2.3 Infraestrutura
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Docker | 27.x | Containerização |
| Docker Compose | v2 | Orquestração local + VPS |
| PostgreSQL | 16 | Banco principal |
| Redis | 7.4 | Cache + queue |
| Caddy | 2.x | Reverse proxy + Let's Encrypt automático |
| Hostinger KVM 2 | — | VPS (2 vCPU, 8GB RAM, 100GB NVMe) |

### 2.4 Integrações externas
| Serviço | Propósito | Módulo no código | Custo MVP |
|---------|-----------|------------------|-----------|
| Clerk | Autenticação | `@clerk/nextjs` direto | R$ 0 (free tier ≤10k MAU) |
| Anthropic API | Extração de etiqueta com vision (fallback) | `src/lib/ai/providers/anthropic.ts` | ~R$ 2/condomínio/mês |
| Google Gemini | Extração de etiqueta com vision (default) | `src/lib/ai/providers/gemini.ts` | ~R$ 0,15/condomínio/mês |
| Meta WhatsApp Cloud API | Envio de notificações + webhook status | `src/lib/meta-whatsapp/` (story 4.1+4.4) | ~R$ 4/condomínio/mês |
| Hostinger | Hospedagem VPS | `infra/docker/Dockerfile` | ~R$ 60/mês total |

### 2.4.1 Módulo `meta-whatsapp` (Epic 4)

Estrutura:
```
src/lib/meta-whatsapp/
├── client.ts          # Singleton MetaWhatsAppClient + sendTemplate (story 4.1)
├── errors.ts          # MetaApiError tipada com mapping de error codes
├── types.ts           # Request/Response types da Cloud API
├── webhook.ts         # verifyMetaSignature HMAC-SHA256 (story 4.4)
└── index.ts           # Re-exports

src/lib/qr/            # Geração QR Code 1200×628 (story 4.2)
src/lib/whatsapp/      # chooseRecipient com matching de nome (story 4.5)
src/lib/queue/jobs/
├── send-whatsapp.ts             # Worker BullMQ envia template (story 4.3)
└── process-whatsapp-webhook.ts  # Worker async processa status updates (story 4.4)
```

**Variáveis de ambiente:**
- `META_APP_ID`, `META_PHONE_NUMBER_ID`, `META_WABA_ID` (públicos)
- `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN` (segredos)
- `META_API_VERSION=v25.0`, `META_DISABLED=true|false` (modo mock pra dev/CI)

**Modo mock:** `META_DISABLED=true` faz `sendTemplate` retornar `wamid` simulado sem bater na Meta — útil em CI e dev sem credenciais.

**Setup operacional:** ver `docs/runbooks/setup-meta-whatsapp.md` (Etapas 1-6).

### 2.5 Hierarquia operacional (Epic 10 — Concluído)

> **Implementado em 2026-05-15.** Schema refatorado com 4 roles e 7 status de pacote. Stories 10.1-10.7 todas Done.

**Refactor realizado no Epic 10:**

| Antes | Depois |
|-------|--------|
| `Role.admin` | `Role.admin_master` (síndico/admin geral) + novo `Role.admin_funcionario` (operacional da admin) |
| Sem flag de admin | `Condominio.tem_administracao Boolean @default(false)` |
| `PacoteStatus`: confirmado → aguardando_retirada (porteiro organiza) | Adiciona `aguardando_organizacao` (entre confirmado e aguardando_retirada, em condomínio com adm) |
| Sem trajeto adm | Adiciona `em_administracao` (após `aguardando_retirada`, quando pacote sai da portaria pra admin entregar) |

**Fluxo bifurcado (após Epic 10):**

```
Condomínio SEM administração (atual):
  porteiro recebe → confirma morador → organiza setor+pos → dispara WhatsApp → entrega QR

Condomínio COM administração:
  porteiro recebe → confirma morador →
    [aguardando_organizacao]
    admin organiza setor+pos → dispara WhatsApp →
    [aguardando_retirada]
    morador apresenta QR → entrega
    (ou pacote vai pra trajeto adm)
    [em_administracao]
    admin entrega ao morador (ou porteiro pode bipar com aviso)
```

**Bipe entrega flexível (FR-083):** qualquer role operacional pode finalizar entrega.

---

## 3. Estrutura de pastas (Monorepo único Next.js)

> **Decisão arquitetural:** monorepo único Next.js no MVP. Ver seção [11.3](#113-migração-monolito--turbo-monorepo) para caminho de migração futura para Turbo.

```
gestao_Pacotes_Condominios/
├── docs/
│   ├── prd/PRD.md
│   ├── architecture/ARCHITECTURE.md          ← este documento
│   ├── stories/                               ← stories do @sm
│   └── runbooks/                              ← procedimentos operacionais
├── prisma/
│   ├── schema.prisma                          ← schema do banco (único arquivo)
│   ├── migrations/                            ← migrations versionadas
│   └── seed.ts                                ← dados iniciais
├── src/
│   ├── app/                                   ← Next.js App Router
│   │   ├── (auth)/                            ← grupo de rotas públicas auth
│   │   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   │   └── sign-up/[[...sign-up]]/page.tsx
│   │   ├── (portaria)/                        ← grupo PWA porteiro
│   │   │   ├── layout.tsx
│   │   │   ├── chegada/page.tsx               ← FR-010 a FR-021
│   │   │   ├── retirada/page.tsx              ← FR-040 a FR-047
│   │   │   └── pendentes/page.tsx
│   │   ├── (admin)/                           ← grupo painel admin
│   │   │   ├── layout.tsx
│   │   │   ├── pacotes/page.tsx               ← FR-060 a FR-064
│   │   │   ├── pacotes/[id]/page.tsx
│   │   │   ├── unidades/page.tsx
│   │   │   ├── moradores/page.tsx
│   │   │   ├── setores/page.tsx
│   │   │   └── importar-csv/page.tsx          ← FR-006
│   │   ├── (super-admin)/                     ← grupo super-admin SaaS
│   │   │   ├── layout.tsx
│   │   │   └── condominios/page.tsx           ← FR-071
│   │   ├── api/
│   │   │   ├── pacotes/
│   │   │   │   ├── route.ts                   ← GET, POST
│   │   │   │   ├── [id]/route.ts
│   │   │   │   ├── [id]/extract/route.ts      ← chama IA
│   │   │   │   └── [id]/retirar/route.ts
│   │   │   ├── unidades/route.ts
│   │   │   ├── moradores/route.ts
│   │   │   ├── importar-csv/route.ts
│   │   │   └── webhooks/
│   │   │       ├── meta-whatsapp/route.ts     ← recebe Meta
│   │   │       └── clerk/route.ts             ← user provisioning
│   │   ├── layout.tsx                         ← root, ClerkProvider
│   │   └── globals.css
│   ├── components/                            ← shadcn/ui + custom
│   │   ├── ui/                                ← shadcn (button, input, etc)
│   │   ├── pacote/
│   │   │   ├── BipeBarcode.tsx                ← html5-qrcode wrapper
│   │   │   ├── FotoEtiqueta.tsx
│   │   │   ├── ConfirmarDadosIA.tsx           ← FR-014
│   │   │   └── ClassificarTamanho.tsx
│   │   └── admin/
│   │       └── PacotesList.tsx
│   ├── lib/
│   │   ├── db.ts                              ← Prisma client singleton
│   │   ├── logger.ts                          ← pino instance
│   │   ├── ai/                                ← IA extraction (Epic 3)
│   │   │   ├── extract-label.ts
│   │   │   ├── prompts/label-extraction.ts
│   │   │   ├── providers/anthropic.ts, gemini.ts
│   │   │   └── schemas/label-extraction.ts
│   │   ├── api/                               ← guards RBAC (Epic 10)
│   │   │   ├── admin-guard.ts                 ← requireAdminMaster/Any
│   │   │   ├── portaria-guard.ts              ← requirePorteiro
│   │   │   ├── super-admin-guard.ts           ← requireSuperAdmin
│   │   │   └── handle-error.ts
│   │   ├── audit/                             ← audit log (Epics 8+12)
│   │   │   ├── write-log.ts                   ← writeAuditLog()
│   │   │   └── audited-mutation.ts            ← auditCreate/Update/Delete
│   │   ├── csv/                               ← CSV import (Epic 2)
│   │   ├── db/                                ← domain helpers (21 files)
│   │   │   ├── bloco.ts, condominio.ts, morador.ts
│   │   │   ├── pacote.ts, setor.ts, unidade.ts
│   │   │   ├── user-management.ts, quotas.ts
│   │   │   └── despesa.ts
│   │   ├── matching/                          ← IA matching (Epic 3)
│   │   ├── meta-whatsapp/                     ← Meta Cloud API (Epic 4)
│   │   │   ├── client.ts, errors.ts, types.ts
│   │   │   ├── webhook.ts
│   │   │   └── index.ts
│   │   ├── qr/                                ← QR generation (Epic 4)
│   │   ├── queue/                             ← BullMQ jobs
│   │   │   ├── connection.ts, queues.ts
│   │   │   └── jobs/                          ← extractLabel, sendWhatsApp, etc.
│   │   ├── storage/                           ← file storage abstraction
│   │   ├── validators/                        ← 11 Zod schemas
│   │   └── whatsapp/                          ← recipient matching (Epic 4)
│   ├── server/
│   │   ├── db-tenant.ts                       ← withTenantContext(), withTenant()
│   │   ├── errors.ts                          ← HTTP-mappable error classes
│   │   └── middleware/
│   │       └── tenant.ts                      ← getTenantContext() + impersonate
│   └── middleware.ts                          ← Clerk auth middleware
├── workers/
│   ├── index.ts                               ← entry point do processo worker
│   ├── jobs/
│   │   ├── extractLabel.ts                    ← processa foto via Anthropic
│   │   ├── sendWhatsApp.ts                    ← envia via Meta
│   │   ├── processIncomingMessage.ts          ← código ML chegando
│   │   └── retentaFalhas.ts
│   └── README.md
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/                                   ← Playwright
├── infra/
│   ├── docker/
│   │   ├── Dockerfile                         ← multi-stage app + worker
│   │   ├── docker-compose.yml                 ← local dev
│   │   ├── docker-compose.prod.yml            ← VPS Hostinger
│   │   └── Caddyfile                          ← reverse proxy
│   ├── scripts/
│   │   ├── deploy.sh                          ← deploy via SSH
│   │   ├── backup-db.sh                       ← backup diário
│   │   └── restore-db.sh
│   └── README.md                              ← runbook de operação
├── .env.example
├── .gitignore
├── .dockerignore
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
└── README.md
```

### 3.1 Por que essa estrutura

- **`src/app/(grupo)`** — App Router groups separam contextos (portaria/admin/super-admin) sem afetar URL.
- **`src/server/`** — separa lógica de domínio do Next.js. Quando migrar pra Turbo, vira `packages/core`.
- **`workers/`** — processo Node separado, sobe junto via Docker Compose. Compartilha `src/lib` e `src/server`.
- **`infra/`** — tudo que é operacional fora do código.

---

## 4. Estratégia Multi-Tenancy (decisão B — híbrido RLS + middleware)

> **Decisão arquitetural:** defesa em profundidade. Middleware aplicacional injeta `condominio_id` em toda query, e RLS PostgreSQL é a rede de segurança que **bloqueia no banco** caso o middleware falhe.

### 4.1 Camada 1 — Middleware aplicacional (primária)

Toda requisição autenticada passa pelo middleware Clerk + middleware tenant:

```typescript
// src/middleware.ts (Clerk)
export default authMiddleware({
  publicRoutes: ['/api/webhooks/(.*)', '/sign-in', '/sign-up'],
});

// src/server/middleware/tenant.ts
// Roda dentro de cada API route / Server Action
export async function getTenantContext() {
  const { userId, orgId } = auth();
  if (!userId) throw new UnauthorizedError();

  // Resolução do condomínio:
  // - Usuário Clerk tem metadata { condominio_id, role }
  // - Super-admin pode trocar via header X-Impersonate-Condominio
  const user = await db.user.findUnique({
    where: { clerk_id: userId },
    select: { condominio_id: true, role: true },
  });

  return {
    userId: user.id,
    condominioId: user.condominio_id, // null = super-admin
    role: user.role,                    // 'porteiro' | 'admin' | 'super_admin'
  };
}

// Antes de qualquer query, seta no Postgres:
await db.$executeRaw`SET LOCAL app.current_condominio = ${condominioId}`;
```

### 4.2 Camada 2 — Row-Level Security PostgreSQL (rede de segurança)

Toda tabela tenant-scoped tem coluna `condominio_id NOT NULL` e policy:

```sql
-- Exemplo: tabela pacote
ALTER TABLE pacote ENABLE ROW LEVEL SECURITY;

CREATE POLICY pacote_tenant_isolation ON pacote
  USING (
    condominio_id = current_setting('app.current_condominio', true)::uuid
    OR current_setting('app.is_super_admin', true)::boolean = true
  );

-- Index obrigatório em condominio_id
CREATE INDEX idx_pacote_condominio ON pacote(condominio_id);
```

### 4.3 Tabelas tenant-scoped vs globais

**Tenant-scoped (têm `condominio_id` + RLS):**
- `bloco`, `unidade`, `morador`, `setor`
- `pacote`, `pacote_evento`, `pacote_foto`
- `whatsapp_message`, `codigo_ml_pendente`

**Globais (sem RLS, acessadas por super-admin):**
- `condominio`
- `user` (mas filtrada por `condominio_id` na maioria das queries)
- `whatsapp_number` (1 registro no MVP, FK opcional pra `condominio_id`)
- `audit_log`
- `despesa` (controle financeiro do operador SaaS)

### 4.4 Por que essa abordagem

- **Middleware** = performance (não recarrega policies a cada query) + ergonomia (Prisma funciona normal).
- **RLS** = garantia matemática contra bug aplicacional (esqueci o `WHERE condominio_id = ?` → RLS bloqueia).
- **Trade-off:** RLS exige `SET LOCAL` antes de cada conexão pool — Prisma extension trata isso automaticamente.

---

## 5. Fluxos críticos sequenciados

### 5.1 Fluxo: Chegada do pacote

```
Porteiro                  Frontend            API/Worker          Externos
   │                         │                    │                   │
   │  abre /chegada          │                    │                   │
   │────────────────────────▶│                    │                   │
   │                         │                    │                   │
   │  bipa código (opcional) │                    │                   │
   │  tira foto da etiqueta  │                    │                   │
   │────────────────────────▶│                    │                   │
   │                         │ POST /api/pacotes  │                   │
   │                         │ (multipart: foto + │                   │
   │                         │  barcode opcional) │                   │
   │                         │───────────────────▶│                   │
   │                         │                    │ salva foto local  │
   │                         │                    │ cria Pacote(rascunho)
   │                         │                    │ enfileira         │
   │                         │                    │ extractLabel job  │
   │                         │ ◀──── jobId ───────│                   │
   │                         │                    │                   │
   │                         │  poll /status      │                    │
   │                         │ (SSE ou polling 1s)│                   │
   │                         │                    │ worker: chama     │
   │                         │                    │ Anthropic c/ cache│
   │                         │                    │──────────────────▶│
   │                         │                    │ ◀─── JSON ────────│
   │                         │                    │ tenta match unid. │
   │                         │ ◀── dados extraídos+match ──│         │
   │                         │                    │                   │
   │  ▼ tela de confirmação  │                    │                   │
   │  (FR-014 — sempre confirmar)                 │                   │
   │  edita se necessário    │                    │                   │
   │  classifica tamanho     │                    │                   │
   │  escolhe setor/posição  │                    │                   │
   │  ─────────────────────▶│                    │                   │
   │                         │ PATCH /api/pacotes │                   │
   │                         │ /{id} (confirmar)  │                   │
   │                         │───────────────────▶│                   │
   │                         │                    │ status=aguardando │
   │                         │                    │ enfileira         │
   │                         │                    │ sendWhatsApp job  │
   │                         │                    │                   │
   │                         │                    │ worker: gera QR   │
   │                         │                    │ chama Meta API    │
   │                         │                    │──────────────────▶│
   │                         │                    │ ◀── messageId ────│
   │                         │                    │ salva whatsapp_msg│
   │                         │ ◀──── sucesso ─────│                   │
   │  ✅ confirmação visual  │                    │                   │
   │ ◀───────────────────────│                    │                   │
```

### 5.2 Fluxo: Notificação WhatsApp (worker `sendWhatsApp` — story 4.3, atualizado 2026-05-08)

1. Trigger: `PATCH /api/pacotes/{id}/organizar` (story 3.9) enfileira `sendWhatsApp` com `jobId: sendWhatsApp:{pacote_id}` (anti-duplicação) na primeira organização. Falha de enfileiramento não bloqueia resposta da API (try/catch isolado).
2. Job recebe `{ pacote_id, condominio_id }`.
3. Carrega pacote + condomínio + WhatsAppNumber compartilhado (`condominio_id IS NULL, ativo=true`). Worker bypassa RLS via `SET LOCAL app.is_super_admin = 'true'` em transação.
4. **`chooseRecipient(pacoteId)`** (story 4.5): matching nome etiqueta → exato/fuzzy/primeiro+último → fallback principal → primeiro adicional com telefone. Retorna `{ morador_id, nome, telefone, matched_by }` ou null.
5. **`ensureQrForPacote(pacoteId)`** (story 4.2, idempotente): se já existe QR, retorna URL; senão gera PNG 1200×628 com sharp (canvas + qrcode + SVG overlay com nome do condomínio), salva em `qr/{condominio_id}/{pacote_id}.png` e atualiza `pacote.qr_image_path`.
6. Cria `WhatsAppMessage` em `pending` antes do envio (preserva audit em caso de falha).
7. Chama `sendTemplate` (story 4.1) → `POST https://graph.facebook.com/v25.0/{phone_number_id}/messages`:
   ```json
   {
     "messaging_product": "whatsapp",
     "to": "5511999999999",
     "type": "template",
     "template": {
       "name": "pacote_chegou",
       "language": { "code": "pt_BR" },
       "components": [
         { "type": "header", "parameters": [{"type": "image", "image": {"link": "<URL pública do QR>"}}] },
         { "type": "body", "parameters": [
             {"type": "text", "text": "Maria Silva"},
             {"type": "text", "text": "Edifício Aurora"}
           ]
         }
       ]
     }
   }
   ```
8. Atualiza `WhatsAppMessage` com `meta_message_id` (wamid) + `status=sent` + `sent_at`.
9. Em erro `MetaApiError.retriable=false` (token inválido, número fora de WhatsApp, código 100/131026/131047): marca `failed` sem throw — BullMQ não retenta.
10. Em erro `retriable=true` (rate 131056, 5xx, network/timeout): throw — BullMQ retenta com backoff exp `5s → 10s → 20s → 40s` (4 attempts total).
11. Modo mock: se `META_DISABLED=true`, `sendTemplate` retorna `wamid: 'mock-...'` simulado sem bater na Meta — útil em CI/dev.

**Reenvio manual:** `POST /api/pacotes/{id}/reenviar-whatsapp` (story 4.6) com auth porteiro/admin, valida `status=aguardando_retirada`, rate limit 3/h por pacote, enfileira com `forceUnique=true` (jobId com timestamp pra evitar dedupe).

### 5.3 Fluxo: Recepção de webhook Meta (story 4.4, atualizado 2026-05-08)

1. `GET /api/webhooks/meta-whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...` — handshake inicial. Valida `verify_token === META_WEBHOOK_VERIFY_TOKEN` e ecoa challenge com 200 text/plain.
2. `POST /api/webhooks/meta-whatsapp` — eventos. Lê body bruto (`request.text()`) ANTES de parsear (necessário pra HMAC).
3. Valida assinatura `X-Hub-Signature-256` via HMAC-SHA256 timing-safe (`crypto.timingSafeEqual`) com `META_APP_SECRET`. Se inválida → 401 (loga apenas IP + body size, **nunca** signature ou body).
4. Para cada `entry[].changes[].value` com `field='messages'`, enfileira job `processWhatsappWebhook` com payload do `value`. Retorna 200 imediatamente (Meta exige <1s).
5. Worker `processWhatsappWebhook` roteia entre dois sub-handlers:

**`handleStatusUpdate`** (status outbound):
- Lookup `WhatsAppMessage WHERE meta_message_id = status.id`. Se não encontrado: log warn + skip.
- Idempotência via `STATUS_RANK` (pending=0, sent=1, delivered=2, read=3, failed=99). Não regride status (delivered → sent é ignorado), exceto failed que sempre vence.
- Atualiza timestamps correspondentes (`sent_at`, `delivered_at`, `read_at`, `failed_at`) + `failure_reason` se houver.

**`handleInboundMessage`** (mensagem do morador — Epic 7 vai consumir):
- Idempotência via `meta_message_id @unique`: se já existe, retorna `duplicate`.
- Lookup `Morador WHERE telefone = message.from` (cross-tenant — número do sistema é compartilhado). Ordena por `updated_at desc` pra preferir morador mais recente.
- Cria `WhatsAppMessage` direção `inbound` com `morador_id` (pode ser null se telefone não cadastrado).
- **Não processa código ML aqui** — apenas registra. Epic 7 cria handler dedicado escutando inserts em WhatsAppMessage inbound.

**Bloqueio:** Etapa 6 do runbook setup-meta-whatsapp (configurar webhook URL no painel Meta) só é executável após deploy em produção, porque Meta faz GET de verificação numa URL pública.

### 5.4 Fluxo: Retirada do pacote

1. Porteiro abre `/retirada` → ativa câmera (html5-qrcode).
2. Scan do QR → frontend extrai `pacoteId + token`.
3. POST `/api/pacotes/{id}/retirar/iniciar` valida token, retorna dados do pacote.
4. Frontend pergunta "destinatário próprio?" → porteiro responde.
5. POST `/api/pacotes/{id}/retirar/confirmar` com `{ proprio_destinatario, nome_se_terceiro }`.
6. API:
   - Valida que pacote ainda está `aguardando_retirada` (idempotência).
   - Cria `pacote_evento` com `{ tipo: 'retirado', funcionario_id, nome_quem_retirou, timestamp }`.
   - Atualiza `pacote.status = 'retirado'`, invalida token.
7. Retorna sucesso.

---

## 6. Setup Docker Compose

### 6.1 Desenvolvimento local (`docker-compose.yml`)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: gestao_pacotes
      POSTGRES_USER: app
      POSTGRES_PASSWORD: dev_secret
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports: ['5432:5432']

  redis:
    image: redis:7.4-alpine
    volumes:
      - redisdata:/data
    ports: ['6379:6379']

  app:
    build:
      context: .
      target: development
    command: npm run dev
    environment:
      DATABASE_URL: postgresql://app:dev_secret@postgres:5432/gestao_pacotes
      REDIS_URL: redis://redis:6379
      # Clerk, Anthropic, Meta vão via .env.local
    volumes:
      - ./:/app
      - /app/node_modules
      - /app/.next
    ports: ['3000:3000']
    depends_on: [postgres, redis]

  worker:
    build:
      context: .
      target: development
    command: npm run worker:dev
    environment:
      DATABASE_URL: postgresql://app:dev_secret@postgres:5432/gestao_pacotes
      REDIS_URL: redis://redis:6379
    volumes:
      - ./:/app
      - /app/node_modules
    depends_on: [postgres, redis]

volumes:
  pgdata:
  redisdata:
```

### 6.2 Produção VPS Hostinger (`docker-compose.prod.yml`)

```yaml
services:
  caddy:
    image: caddy:2-alpine
    restart: always
    ports: ['80:80', '443:443']
    volumes:
      - ./infra/docker/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [app]

  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB: gestao_pacotes
      POSTGRES_USER: app
      POSTGRES_PASSWORD_FILE: /run/secrets/pg_password
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./infra/scripts/backup-db.sh:/usr/local/bin/backup-db.sh:ro
    secrets: [pg_password]

  redis:
    image: redis:7.4-alpine
    restart: always
    volumes: [redisdata:/data]

  app:
    image: gestao-pacotes:${VERSION}
    restart: always
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://app@postgres:5432/gestao_pacotes
      REDIS_URL: redis://redis:6379
    env_file: .env.production
    volumes:
      - storage:/app/storage           # fotos das etiquetas
    depends_on: [postgres, redis]
    healthcheck:
      test: curl -f http://localhost:3000/api/health
      interval: 30s

  worker:
    image: gestao-pacotes:${VERSION}
    command: node workers/index.js
    restart: always
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://app@postgres:5432/gestao_pacotes
      REDIS_URL: redis://redis:6379
    env_file: .env.production
    volumes: [storage:/app/storage]
    depends_on: [postgres, redis]

volumes:
  pgdata:
  redisdata:
  storage:
  caddy_data:
  caddy_config:

secrets:
  pg_password:
    file: ./secrets/pg_password.txt
```

### 6.3 Caddyfile

```
sistema.seudominio.com.br {
  reverse_proxy app:3000
  encode gzip
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
  }
}
```

Caddy resolve Let's Encrypt automaticamente. **Zero config SSL.**

---

## 7. Estratégia de deploy

### 7.1 Pipeline CI/CD (GitHub Actions, configurado pelo `@devops`)

```
push para main
   │
   ├── lint + typecheck + test (paralelo)
   ├── build Docker image multi-stage
   ├── tag image: gestao-pacotes:{git-sha}
   ├── push para GitHub Container Registry (ghcr.io) — gratuito
   └── deploy SSH para VPS Hostinger:
        - pull nova imagem
        - docker compose up -d --no-deps app worker (rolling restart)
        - run prisma migrate deploy (idempotente)
        - smoke test: curl /api/health
        - se falhar: rollback para imagem anterior
```

### 7.2 Zero-downtime no MVP

- **App + worker** podem ter `--no-deps` rolling restart (Docker Compose).
- **Banco** roda sempre, migrations Prisma são backwards-compatible (regra de ouro).
- **Caddy** mantém conexões durante restart do app (graceful drain).

### 7.3 Backup

- Cron diário 03:00 BRT roda `backup-db.sh`:
  - `pg_dump` para `/backups/{date}.sql.gz`
  - Upload pra **Hostinger Object Storage** (ou Backblaze B2 — US$ 0,005/GB/mês)
  - Retenção 30 dias local, 90 dias remoto.
- **Restore documentado** em `docs/runbooks/restore-db.md`.

---

## 8. Observabilidade mínima

### 8.1 Logs estruturados (Pino)

```typescript
logger.info({
  event: 'pacote.criado',
  condominio_id,
  pacote_id,
  funcionario_id,
  duration_ms,
}, 'Pacote criado com sucesso');
```

Logs vão para `stdout` → Docker captura → arquivo rotativo via `json-file` driver com `max-size: 10m, max-file: 5`.

### 8.2 Métricas

**MVP enxuto:**
- Endpoint `/api/health` retorna `{ status, db, redis, uptime }` para monitor externo.
- **Uptime Robot** (gratuito, 50 monitors) bate `/api/health` a cada 5 min, alerta por e-mail/Telegram.

**Pós-MVP (quando dor justificar):**
- Prometheus + Grafana via container adicional.
- Dashboards: latência API, fila BullMQ, custo Anthropic/dia, taxa entrega WhatsApp.

### 8.3 Alertas críticos (manuais via UptimeRobot + Pino + grep)

| Alerta | Condição | Ação |
|--------|----------|------|
| App down | `/api/health` 5xx por 2 min | E-mail + Telegram |
| Worker travado | Sem job processado em 10 min E houver pendentes | E-mail |
| Quality rating Meta caiu | Webhook Meta `account_update` reporta queda | E-mail urgente |
| Disk >85% | Cron checa `df` diário | E-mail |
| Backup falhou | Script de backup com exit code !=0 | E-mail urgente |

---

## 9. Segurança em camadas

### 9.1 Autenticação (Clerk)

- **Sign-in via e-mail + senha** ou magic link (configurável).
- Sessão: cookie httpOnly + secure, expira 7 dias (NFR-021).
- **Rotação de chave Clerk** documentada em `docs/runbooks/rotate-clerk-keys.md`.

### 9.2 Autorização (RBAC)

4 roles (após Epic 10):
- `porteiro` — pode bipar, registrar, retirar pacotes.
- `admin_funcionario` — operacional da administração (secretária, zelador adm). Organiza pacotes, acessa painel admin.
- `admin_master` — síndico/admin geral. Tudo do funcionário + gerenciar equipe + configurações.
- `super_admin` — tudo + criar condomínio + impersonar + CRUD cross-tenant.

Guards em `src/lib/api/`:
- `requirePorteiro()` — porteiro + qualquer admin
- `requireAdminAny()` — admin_master ou admin_funcionario
- `requireAdminMaster()` — admin_master only
- `requireSuperAdmin()` — super_admin only

Role armazenado em `user.role` + Clerk `publicMetadata.role` (sincronizado via webhook Clerk).

### 9.3 CSRF Protection (middleware)

Middleware Next.js valida `Origin` header em requests de mutação (POST/PUT/PATCH/DELETE):
- Compara `Origin` host com `Host` header — rejeita cross-origin com 403 `csrf_rejected`
- Webhooks (`/api/webhooks/`) isentos (Meta envia de domínio externo)
- Requests sem `Origin` (same-origin fetch, server-side) passam normalmente

```typescript
// src/middleware.ts — integrado ao clerkMiddleware
if (MUTATION_METHODS.has(req.method) && origin && new URL(origin).host !== host) {
  return NextResponse.json({ code: 'csrf_rejected' }, { status: 403 });
}
```

### 9.4 Webhooks Meta — validação HMAC

```typescript
// src/lib/whatsapp/webhook-verify.ts
import { createHmac, timingSafeEqual } from 'crypto';

export function verifyMetaWebhook(rawBody: string, signature: string, secret: string) {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signature.replace('sha256=', '');
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}
```

### 9.5 UUID Param Validation

Todas as rotas com `[id]` dinâmico validam UUID antes de consultar o banco:

```typescript
// src/lib/validators/_shared.ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseIdParam(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  return UUID_RE.test(id) ? id : null;
}
```

16 rotas protegidas: admin/blocos, condominios, moradores, setores, unidades, pacotes (cancelar, confirmar, organizar, reenviar, reagendar, retirar), super-admin/users, super-admin/despesas.

### 9.6 URLs assinadas para fotos

Storage local não expõe diretamente. Endpoint `/api/pacotes/{id}/foto` valida:
1. Auth (Clerk).
2. Tenant (mesmo `condominio_id` do pacote).
3. Token query string com expiração 1h (HMAC + timestamp).

### 9.7 Rate limiting

- `/api/webhooks/meta-whatsapp` — sem rate limit (Meta exige resposta).
- Demais endpoints: 60 req/min por IP (nginx `limit_req_zone`).
- Impersonate start: 20/hora por usuario (contagem via `audit_log` entries).
- Reenviar WhatsApp: 3/hora por pacote (contagem em `WhatsAppMessage`).

### 9.8 Security Headers (produção — nginx)

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev; ...
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Referrer-Policy: strict-origin-when-cross-origin
```

- `X-Powered-By` removido via `poweredByHeader: false` (next.config.ts)
- `server_tokens off` no nginx (sem versão no header)

### 9.9 Audit Log RLS

A tabela `audit_log` possui Row-Level Security habilitado com 4 policies:
- **SELECT:** tenant ve logs do proprio condominio, super_admin ve todos
- **INSERT:** qualquer role autenticado pode escrever (sem restrição)
- **UPDATE/DELETE:** apenas super_admin (logs devem ser imutaveis)

### 9.10 Foreign Key Protection

9 foreign keys convertidas de `CASCADE` para `RESTRICT` (migration `20260519180000`):
- Previne deleção acidental de condominio/unidade/morador que apagaria dados dependentes
- Tabelas protegidas: bloco, setor, unidade, pacote, user, whatsapp_number, audit_log → condominio; morador → unidade; codigo_ml → morador

### 9.11 AI Provider Timeouts

Ambos os providers IA possuem timeout de 30s:
- Anthropic: `timeout: 30_000` no constructor do SDK
- Gemini: `requestOptions: { timeout: 30_000 }` no `generateContent`

### 9.12 Secrets

- Local: `.env.local` (gitignored).
- Produção: `.env.production` na VPS, permissão `600`, owner root.
- **Nunca** commitar. `.env.example` lista variáveis sem valores.
- Rotação de 6 secrets pendente para primeiro onboarding de cliente.

---

## 10. Contratos de API (rascunho — `@dev` detalha por story)

### 10.1 Pacotes

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/pacotes` | Lista pacotes do condomínio (filtros via query) |
| POST | `/api/pacotes` | Cria pacote rascunho (multipart: foto, barcode opcional) |
| GET | `/api/pacotes/{id}` | Detalhe completo |
| POST | `/api/pacotes/{id}/confirmar` | Confirma dados IA |
| POST | `/api/pacotes/{id}/organizar` | Define setor+posição, dispara WhatsApp |
| POST | `/api/pacotes/{id}/cancelar` | Cancelamento do pacote |
| POST | `/api/pacotes/{id}/enviar-administracao` | Transição → em_administracao (Epic 10) |
| POST | `/api/pacotes/{id}/reenviar-whatsapp` | Reenvio manual (rate limit 3/h) |
| POST | `/api/pacotes/{id}/reagendar-lembrete` | Reagenda lembrete pausado (admin_master) |
| GET | `/api/pacotes/{id}/extract-status` | Status do job de extração IA |
| POST | `/api/pacotes/retirar/iniciar` | Valida QR token |
| POST | `/api/pacotes/{id}/retirar/confirmar` | Registra retirada |

### 10.2 Cadastros Admin (tenant-scoped)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET/POST | `/api/admin/blocos` | CRUD blocos (Epic 11) |
| GET/PATCH/DELETE | `/api/admin/blocos/[id]` | Operações por bloco |
| GET/POST | `/api/admin/moradores` | Lista + criação moradores |
| GET/PATCH/DELETE | `/api/admin/moradores/[id]` | Operações por morador |
| GET/POST | `/api/admin/unidades` | Lista + criação unidades |
| GET/PATCH/DELETE | `/api/admin/unidades/[id]` | Operações por unidade |
| GET/POST | `/api/admin/setores` | Lista + criação setores |
| GET/PATCH/DELETE | `/api/admin/setores/[id]` | Operações por setor |
| GET | `/api/admin/search` | Busca global Cmd+K (Epic 11) |
| POST | `/api/admin/users` | Admin cria porteiro/admin do mesmo cond (Epic 8) |

### 10.3 Super-Admin

| Método | Rota | Descrição |
|--------|------|-----------|
| GET/POST | `/api/admin/condominios` | CRUD condominios |
| GET/PATCH/DELETE | `/api/admin/condominios/[id]` | Detalhe + desativar/reativar/arquivar |
| POST | `/api/super-admin/impersonate/start` | Inicia impersonate (seta cookie) |
| POST | `/api/super-admin/impersonate/stop` | Encerra impersonate |
| GET/POST | `/api/super-admin/users` | Lista todos usuários / cria admin cross-tenant |
| PATCH | `/api/super-admin/users/[id]` | Edita usuário cross-tenant |
| GET/POST | `/api/super-admin/despesas` | CRUD despesas financeiras |

### 10.4 Webhooks

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/webhooks/meta-whatsapp` | Verificação Meta (challenge) |
| POST | `/api/webhooks/meta-whatsapp` | Eventos Meta (msg, status) |
| POST | `/api/webhooks/clerk` | User provisioning |

### 10.5 Health e Contexto

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Status app + db + redis |
| GET | `/api/health/db` | Ping PostgreSQL isolado |
| GET | `/api/health/redis` | Ping Redis isolado |
| GET | `/api/me` | TenantContext do usuário autenticado |

---

## 11. Decisões arquiteturais e caminhos de migração

### 11.1 Autenticação: Clerk → Auth caseiro (se virar custo)

**Decisão MVP:** Clerk pelo zero esforço e free tier (10.000 MAU).

**Quando reavaliar:** quando MAU se aproximar de 8.000 (80% do limite) **ou** quando custo Clerk > R$ 200/mês.

**Caminho de migração:**
1. Implementar Auth.js (NextAuth) em paralelo com adapter Prisma.
2. Espelhar usuários Clerk → tabela `user` (já existe via webhook Clerk).
3. Migração gradual: novos signups vão para Auth.js, sessões Clerk continuam ativas até expirar.
4. Após 30 dias, desativar Clerk.

**Esforço estimado:** 3-5 dias dev sênior. **Documentar com antecedência em `docs/runbooks/migrate-clerk-to-authjs.md` quando MAU passar 5.000.**

### 11.2 Storage: volume Docker → MinIO/S3

**Decisão MVP:** volume local Docker (`/storage`).

**Quando reavaliar:** quando volume passar 30GB **ou** quando precisar acesso de múltiplas VPS.

**Caminho de migração:**
1. Subir MinIO em container ou contratar Hostinger Object Storage.
2. Adapter abstrato `StorageService` (já implementar no MVP — usa local, mas interface igual a S3).
3. Migração one-shot: rsync do volume → MinIO.
4. Trocar variável de ambiente.

**Esforço:** <1 dia se interface estiver pronta.

### 11.3 Migração: monolito → Turbo monorepo

**Decisão MVP:** Next.js único, worker como processo separado dentro do mesmo repo.

**Quando reavaliar:** quando >2 devs simultâneos OU quando build do Next.js passar 5 min OU quando worker precisar deploy independente.

**Caminho de migração:**
1. Criar `apps/web` (mover `src/app`, `src/components`).
2. Criar `apps/worker` (mover `workers/`).
3. Criar `packages/db` (mover `prisma/`).
4. Criar `packages/core` (mover `src/server/`, `src/lib/`).
5. Criar `packages/types` (mover `src/types/`).
6. Configurar Turbo (`turbo.json`) com pipeline build/lint/test.
7. Atualizar Dockerfile multi-stage para usar Turbo prune.

**Esforço:** 2-3 dias dev sênior. **Documentar antes de chegar lá em `docs/runbooks/migrate-to-turbo.md`.**

### 11.4 BSP WhatsApp: Meta Direto → Z-API/Take Blip

**Decisão MVP:** Meta Cloud API direto.

**Quando reavaliar:** quando >15 condomínios OU quando suporte em PT virar gargalo OU quando quiser painel pronto de atendimento.

**Caminho de migração:**
1. Contratar BSP (Z-API Cloud API ou Take Blip).
2. Migrar **mesmo número** via Meta Business Manager (transferência de WABA).
3. Templates já aprovados continuam válidos.
4. Trocar variável `WHATSAPP_API_BASE_URL` + token.
5. Webhook signature pode ter formato diferente — adaptar `webhook-verify.ts`.

**Esforço:** 2-4 dias dev + 1-2 semanas burocracia Meta.

### 11.5 Banco: PostgreSQL no mesmo Docker → managed

**Decisão MVP:** Postgres em container, mesma VPS.

**Quando reavaliar:** quando banco passar 20GB OU >100 condomínios OU latência de query >100ms (P95).

**Caminho de migração:**
1. Contratar Postgres gerenciado (Hostinger, Neon, Supabase, RDS).
2. `pg_dump` + restore com janela de manutenção curta (~10 min).
3. Trocar `DATABASE_URL`.
4. RLS continua funcionando (é feature do Postgres, não do hosting).

**Esforço:** 1 dia + janela de manutenção.

### 11.6 Modelo WhatsApp: número único → dedicado por condomínio (premium)

Já documentado no PRD (seção feature premium futura). Tabela `whatsapp_number` já nasce preparada com FK opcional para `condominio_id`.

---

## 12. Variáveis de ambiente (`.env.example`)

```bash
# Core
NODE_ENV=development
APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://app:dev_secret@localhost:5432/gestao_pacotes
REDIS_URL=redis://localhost:6379

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-haiku-4-5
ANTHROPIC_PROMPT_CACHE_ENABLED=true

# Meta WhatsApp Cloud API
META_PHONE_NUMBER_ID=...
META_WABA_ID=...
META_ACCESS_TOKEN=EAAG...
META_WEBHOOK_VERIFY_TOKEN=randomtoken123
META_APP_SECRET=...

# Storage
STORAGE_DRIVER=local                # local | s3 | minio
STORAGE_LOCAL_PATH=/app/storage

# Logs
LOG_LEVEL=info

# Super-admin (seed inicial)
SUPER_ADMIN_EMAIL=gustavs.silvs@gmail.com
```

---

## 13. Estado atual e próximos passos (2026-05-19)

**Concluído:**
- Epics 1-6 (MVP completo), Epic 8 (super-admin), Epic 10 (hierarquia operacional), Epic 11 (UX refinado)
- Epic 7 parcial (7.1, 7.5), Epic 12 completo (12.1-12.6)
- ~55 stories Done, 450+ testes, MVP em produção
- **Security hardening completo** (2026-05-19): CSRF, UUID validation, CASCADE→RESTRICT, audit log RLS, AI timeouts, security headers, rate limiting, SQL injection fix

**Próximos:**
1. **Epic 7 restante (7.4, 7.6):** banner durante chegada, templates Meta (bloqueio externo)
2. **Rotação de secrets** — 6 secrets pendentes para primeiro onboarding
3. **Backup offsite** — atualmente backup só na própria VPS
