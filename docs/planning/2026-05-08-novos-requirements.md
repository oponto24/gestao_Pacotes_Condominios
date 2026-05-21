# Novos Requirements — Captura 2026-05-08

> **Origem:** mensagens do user durante deploy Etapa 6.
> **Status:** capturado — aguarda priorização e quebra em stories antes de implementar.

---

## R1 — Super Admin: dashboard + governança de condomínios

**O que o user pediu** (mensagem 1):

> "vou auditar aqui no pc o super admin e o admin ok? o super admin precisa abrir e ter uma visao de quantos condominios estão ativos, admins ativos, pacotes nas ultimas 24h pendentes, usuarios no geral ativos (com admins e porteiros). na parte de condominios tem que da para desativar um condominio. usuarios tem que ter a funcao de admin e de porteiro para editar, adicionar e apagar e audit log tem que ser de tudo que aontece no app"

### Quebra em capabilities

**R1.1 — Dashboard `/super-admin`** (cards de KPIs):
- Total de condomínios **ativos** (vs. desativados)
- Total de **admins ativos** (cross-tenant — todos os condomínios)
- Total de **pacotes pendentes** nas últimas 24h (cross-tenant)
- Total de **usuários ativos** (admins + porteiros, separados em colunas)

**R1.2 — Desativação de condomínio:**
- Ação "Desativar" em `/super-admin/condominios/[id]`
- Soft delete: `condominio.ativo = false` (já existe no schema?)
- Impacto: bloqueia login dos users desse condomínio + remove da lista geral
- Reversível (super-admin pode reativar)

**R1.3 — CRUD de usuários (super-admin):**
- Listar todos users do sistema (com filtro por condomínio)
- Adicionar usuário com role escolhida (`admin` ou `porteiro`)
- Editar (mudar role, mudar condomínio, ativar/desativar)
- Apagar (soft delete pra preservar audit log)

**R1.4 — Audit log de tudo:**
- Registrar **toda** ação sensível: login, criação/edição/apagar usuário/condomínio/setor/unidade/morador, organização/retirada/cancelamento de pacote, envio/reenvio WhatsApp, configuração webhook, mudança de role
- Tabela `audit_log` já existe (schema 1.10) — falta cobertura completa
- UI de filtragem por: ator, ação, recurso, período, condomínio

### Estado atual no código
- ✅ `super-admin/condominios` — lista existe, sem botão desativar
- ✅ `super-admin/users` — lista parcial (story 8.x) — falta CRUD completo
- ✅ `super-admin/audit` — page existe — cobertura incompleta
- ❌ Dashboard com KPIs cross-tenant — **não existe**

---

## R2 — Níveis de admin: admin geral + funcionário da administração

**O que o user pediu** (mensagem 2):

> "precisamos pensar em niveis de admin admin geral do predio e funcionarios da administração porque as vezes a portaria pega o pacote e manda para a adm entregar para o morador e ai esse admin precisa ter a opcao de bipar a saida de um pacote da administracao"

### Interpretação

Hoje o role enum tem: `super_admin | admin | porteiro`. User quer dividir o `admin` em:

**`admin_master`** (admin geral do prédio, ex: síndico):
- Cadastros completos (setores, unidades, moradores, equipe)
- Vê dashboard administrativo do condomínio
- Pode adicionar/editar/desativar outros admins e porteiros do mesmo condomínio
- (provavelmente) pode bipar saída também

**`admin_funcionario`** (funcionário da administração, ex: secretária):
- **NOVA capability principal:** "bipar saída" — pacote sai da portaria, entra na administração, depois é entregue ao morador
- Acesso restrito a operações operacionais (não cadastra usuários nem desativa estrutura)
- Vê lista de pacotes em trânsito pela administração

### Novo fluxo de pacote — "rota administração"

```
Estado atual: portaria recebe → organiza → notifica → morador retira
Estado futuro: portaria recebe → organiza →
                  ├─ retirada normal: morador retira no QR
                  └─ rota admin: porteiro envia para administração →
                       admin_funcionario "recebe na adm" (bipe saída da portaria) →
                       admin_funcionario entrega ao morador (bipe entrega final)
```

### Requisitos derivados

**R2.1 — Refactor enum `Role`:**
- Migrar `admin` → `admin_master` em todos os users existentes (migration data)
- Adicionar `admin_funcionario`
- Atualizar guards em `requireAdmin`, `requirePorteiro`, etc.

**R2.2 — Novo status de pacote `em_administracao`:**
- Adicionar enum `PacoteStatus.em_administracao`
- Transição: `aguardando_retirada` → `em_administracao` (via "enviar pra adm") → `retirado` (via "entregar ao morador")

**R2.3 — UI portaria — botão "Enviar pra administração":**
- Na tela do pacote em `aguardando_retirada`, novo CTA "Enviar pra Administração"
- Confirmação + audit log
- Pacote sai da fila portaria, entra na fila adm

**R2.4 — UI administração — `/administracao`:**
- Nova rota PWA mobile-first acessível por `admin_funcionario`
- Lista de pacotes `em_administracao` no condomínio
- Bipar saída (mesma UX da retirada, mas registra como "saída da portaria pra adm")
- Bipar entrega (igual retirada normal)

**R2.5 — Permissões — `admin_funcionario` pode:**
- Acessar `/administracao` (operacional)
- Ver pacotes em `em_administracao` ou `aguardando_retirada` (read)
- NÃO acessa cadastros nem desativação

**R2.6 — Bipe entrega final (decisão user 2026-05-08):**
- **Qualquer role operacional pode bipar entrega final ao morador** — porteiro, admin_funcionario ou admin_master
- Razão: flexibilidade — se admin estiver fora, porteiro entrega; se admin estiver disponível, ele entrega
- Audit log registra **qual user** (e portanto qual role) finalizou a entrega — visível no detalhe do pacote
- UI: quando porteiro escaneia QR de pacote em `em_administracao`, sistema avisa "este pacote está na adm — confirma entrega?" e prossegue se ele OK

---

## R3 — Hierarquia Torres/Blocos > Apartamentos

**O que o user pediu** (mensagem 3):

> "na parte de Unidades muda para torres/blocos ou algo do tipo ai la vai ter todas as torres ou blocos de um apartamento e dentro disso vai ter cada apartamento cadastrado assim fica mais organizado e tudo tem que ter opcao de filtro. o app tem que ter opcao de produrar morador, produrar pacote muito facil para a admin"

### Interpretação

Hoje:
- `/admin/cadastros` tem rotas pra Unidades (com `bloco` opcional como string)
- Schema: `unidade` tem `bloco VARCHAR(20)` opcional + `identificador` (apto)
- Listagem flat — bloco aparece como label, sem agrupamento real

User quer:
- Renomear UI "Unidades" → **"Torres/Blocos"** (label de menu)
- Hierarquia visual: **Torre/Bloco → Apartamento**
- Em cada torre, lista de apartamentos cadastrados
- Filtros em todas as listas (já temos parcial)
- Busca **fácil** por morador e por pacote (admin operacional)

### Requisitos derivados

**R3.1 — Modelo `Bloco` (entidade própria):**
- Nova tabela `bloco`: `{ id, condominio_id, nome, descricao, ordem, ativo }`
- Migration: extrair `bloco` string da `unidade` pra FK `bloco_id` (criar blocos a partir dos valores distintos existentes)
- Deprecar `unidade.bloco` string (manter campo legacy por 1 release pra rollback)

**R3.2 — UI hierárquica:**
- Menu lateral admin: **"Torres/Blocos"** (no lugar de "Unidades")
- Listagem `/admin/blocos`:
  - Card por bloco com contador de apartamentos
  - Click em bloco → drill down `/admin/blocos/[id]`
- Listagem `/admin/blocos/[id]`:
  - Header com nome do bloco
  - Lista de apartamentos com filtros (status morador, busca textual)

**R3.3 — Busca rápida global pra admin:**
- Componente `<GlobalSearch />` no header admin
- Busca em `morador.nome`, `morador.telefone`, `pacote.codigo_rastreio`, `pacote.id`, `unidade.identificador`
- Atalho `⌘K` / `Ctrl+K`
- Resultados em dropdown com link direto pra detalhe

**R3.4 — Filtros em todas as listas:**
- Auditar listas existentes (`/admin/pacotes`, `/admin/moradores`, `/admin/setores`)
- Padronizar filtros: status, bloco, período, etc.

---

## R4 — (já implícito em R1) Audit log de tudo

Já coberto em **R1.4**. Reforçar:
- Cobertura **completa** — toda mutation no app gera entrada em `audit_log`
- Inclui ações de webhook Meta (mensagem inbound recebida, status change)
- Inclui ações de admin levels novos (R2)

---

## R5 — Código ML via WhatsApp (Epic 7 — já no PRD original)

**O que o user pediu** (mensagem 5 — 2026-05-08 22h30):

> "ja pensarmos sobre como o morador vai mandar o codigo de verificacao da compra pensei em algo como so moradores cadastrados pode mandar ai quando ele mandar a ia analisa ve qual o codigo e ja linka o numero no manco de dados ai aparece pro porteiro quem e de qual apartamento e etc como tiver ai na documentacao essa parte"

### Status atual

✅ **Já está no PRD §3.5 (FR-050 a FR-056)** e **Epic 7** no ROADMAP (Draft, P1).
✅ **Webhook handler 4.4 já registra** mensagens inbound em `WhatsAppMessage direction='inbound'` com `morador_id` resolvido por telefone.

Falta apenas implementar Epic 7. As stories já existem em rascunho:

| # | Story | Descrição |
|---|---|---|
| 7.1 | Worker `processIncomingMessage` consome novos `WhatsAppMessage inbound` | Lookup morador (já feito na 4.4) → extrai código ML via regex+LLM |
| 7.2 | Persiste `codigo_ml_pendente` (tabela já existe no schema) com `expira_em = now+30d` | FR-053: envia auto-reply "Recebemos seu código" via Meta template |
| 7.3 | UI banner amarelo na tela `/chegada/organizar` | FR-054/055: lista códigos ML pendentes do morador, porteiro escolhe |
| 7.4 | Cron diário expira códigos > 30d | FR-056 |

### Confirmação de regras de negócio (R5)

| Pergunta | Resposta user (2026-05-08) |
|---|---|
| Quem pode mandar? | **Apenas moradores cadastrados** (telefone batendo com `morador.telefone`) |
| Como identificamos? | **Lookup por telefone** (já implementado na 4.4 — handler inbound). Se não cadastrado, mensagem é registrada mas **ignorada** (sem reply, sem código vinculado) |
| Como a IA processa? | Regex simples primeiro (códigos ML têm formato conhecido). Fallback LLM só se regex falhar (custo) |
| Onde aparece pro porteiro? | Banner na tela de organizar pacote, **quando o porteiro está organizando um pacote do mesmo morador**. Banner mostra: "Este morador (Maria Silva, apto 31) tem 2 códigos ML pendentes. Vincular?" |

### Decisão pendente

⚠️ **Privacidade:** mensagens inbound de **telefones desconhecidos** (não cadastrados) — armazenamos? Por quanto tempo?
- **Sugestão:** sim, armazenar 30 dias pra audit (caso usuário se cadastre depois). Pode ser útil pra suporte ("alguém mandou de tal número")
- LGPD: dado mínimo (telefone + body), não identificável diretamente, retenção curta

### Esforço estimado Epic 7

~2-3 dias dev (4 stories pequenas).

---

## Análise de impacto

| Requirement | Esforço estimado | Complexidade | Bloqueia? |
|---|---|---|---|
| R1.1 Dashboard super-admin | 0.5 dia | baixa | nada |
| R1.2 Desativar condomínio | 0.25 dia | baixa | nada |
| R1.3 CRUD users super-admin | 1 dia | média | depende parcial 8.5-8.7 que já era backlog |
| R1.4 Audit log completo | 1.5 dia | alta (refactor cross-cutting) | nada |
| R2.1 Refactor Role enum | 0.5 dia | média (migration + guards) | bloqueia R2.3-R2.5 |
| R2.2 Status `em_administracao` | 0.25 dia | baixa | bloqueia R2.3-R2.4 |
| R2.3 UI portaria "enviar pra adm" | 0.5 dia | baixa | depende R2.2 |
| R2.4 UI administração | 1 dia | média | depende R2.1, R2.2 |
| R2.5 Permissões `admin_funcionario` | 0.25 dia | baixa | depende R2.1 |
| R3.1 Modelo `Bloco` | 0.5 dia | média (migration de dados) | bloqueia R3.2 |
| R3.2 UI hierárquica | 0.75 dia | baixa | depende R3.1 |
| R3.3 Busca global ⌘K | 0.5 dia | baixa | nada |
| R3.4 Filtros padronizados | 0.5 dia | baixa | nada |

**Total estimado:** ~8 dias dev

---

## Proposta de epic novo

### Epic 9 — Operação SaaS Madura (post-MVP, antes do piloto)

| Story | Conteúdo |
|---|---|
| 9.1 | Dashboard `/super-admin` com KPIs cross-tenant |
| 9.2 | Desativar/reativar condomínio (super-admin) |
| 9.3 | CRUD usuários (super-admin) — listar, criar, editar role/condominio, soft delete |
| 9.4 | Audit log completo — middleware que captura toda mutation + UI filtros |

### Epic 10 — Hierarquia Operacional

| Story | Conteúdo |
|---|---|
| 10.1 | Refactor enum `Role`: `admin` → `admin_master`, novo `admin_funcionario` (migration + guards) |
| 10.2 | Status `pacote.em_administracao` + audit |
| 10.3 | UI portaria — botão "Enviar pra Administração" no detalhe pacote |
| 10.4 | UI `/administracao` PWA — lista pacotes em trânsito + bipe saída + entrega |
| 10.5 | Permissões `admin_funcionario` (rotas, guards, navegação) |

### Epic 11 — UX Admin Refinado

| Story | Conteúdo |
|---|---|
| 11.1 | Modelo `Bloco` (entidade) + migration extraindo de `unidade.bloco` string |
| 11.2 | UI `/admin/blocos` hierárquica (lista de blocos → drill down apartamentos) |
| 11.3 | Busca global `<GlobalSearch />` com ⌘K em header admin (morador + pacote + unidade) |
| 11.4 | Filtros padronizados em todas as listas admin |
| 11.5 | Renomear menu "Unidades" → "Torres/Blocos" |

---

## Próximos passos sugeridos

1. **Você revisa este doc** — confere se interpretação bate com sua intenção
2. **Priorizar:** qual epic vem primeiro? (sugestão minha: 10 → 11 → 9, porque 10 é diferenciador competitivo, 11 melhora UX cotidiana, 9 é operacional SaaS)
3. **@sm rascunha as stories** do epic priorizado
4. **@po valida** → **@dev implementa** → **@qa gate** → **@devops merge** (mesmo flow do Epic 4)

### Sequência sugerida pós-revisão (atualizada 2026-05-08 22h30)

1. **Epic 10** — admin multi-nível + rota administração (diferencial competitivo, user explicitou necessidade real)
2. **Epic 7** — Código ML via WhatsApp (já no PRD, só implementar — webhook handler 4.4 já registra inbound; falta parser + UI banner)
3. **Epic 11** — UX admin refinado (Torres/Blocos + busca global)
4. **Epic 9** — Operação SaaS madura (super-admin dashboard + audit completo)

**Total estimado:** ~10-13 dias dev + buffer.







1. Toggle "tem administração?" — onde fica essa decisão?                                                                                                              
exatamente na hora de cadastrar o condominio ja faz a pergunta                                                                                                                                                              
                                                                     
  2. App próprio gerar código — esclarecer                                                                                                                              
  
  Você disse: "o proprio app da codigo em algumas compras". Pode explicar com exemplo? Não entendi se é:                         
  o mercado livre para algumas comprar manda um codigo para quando o entregador vim perguntar a palavra chave para poder deixar a compra sem isso ele nao deixa , o que acontece em predio e o morador esquecer de deixar com o porteiro e quando o entregador vem nao tem ninguem em casa e o porteiro nao sabe o codigo assim o entregador volta                                       
                                                                     
                                                                                                                                           
                                                                                                                                                                        
  3. Onde aparecem códigos ML — pro PORTEIRO ou pra ADMIN?                                                                                                              
  vamos chamar de palavra chave apartir de agora e elas vou aparecer para o porteiro sempre porque e quem retira mais pode ter uma aba para o admin ver tambem 

                                                                                                                     
                                                                                                                                                                        
  4. Pendente identificação — quem resolve?                                                                                                                             
                                                                                                                                                 esses casos a Ia tem que colocar os dados que consegiu e ai o porteiro ou a adm pode resolver                        
  