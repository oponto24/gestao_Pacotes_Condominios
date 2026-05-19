# PRD — Sistema de Gestão de Pacotes em Condomínios

> **Versão:** 2.0 (pós-MVP, Epics 7-12)
> **Status:** Em execução — MVP completo, pós-MVP em andamento
> **Owner:** Gustavo Silva
> **PM responsável:** Morgan (AIOX PM Agent)
> **Última atualização:** 2026-05-19

---

## 1. Visão e contexto

### 1.1 Problema

A gestão de pacotes em condomínios é hoje predominantemente manual: o porteiro recebe encomendas (Correios, Mercado Livre, Shopee, Magalu), anota em caderno ou planilha, e não há registro confiável de quem retirou, quando, onde o pacote foi guardado, ou qual funcionário recebeu/entregou. Isso gera **extravios, retrabalho, conflitos com moradores e ausência de auditoria**.

Adicionalmente, alguns pedidos (sobretudo Mercado Livre) exigem código de retirada que o entregador pede ao receber o pacote — o porteiro não tem esse código no momento certo, gerando atrasos e devoluções.

### 1.2 Solução proposta

Sistema web mobile-first (PWA) para portaria/administração, com notificação ao morador via **WhatsApp** (canal universal, sem necessidade de instalar aplicativo). Cada pacote recebe um **QR Code único** que serve como prova de retirada. Pipeline de IA (Claude Haiku 4.5 com vision) extrai dados da etiqueta automaticamente a partir de uma foto, eliminando digitação manual.

### 1.3 Diferenciais competitivos

- **Zero fricção pro morador:** sem app, sem cadastro complexo, recebe e usa o QR Code direto no WhatsApp.
- **Bipe + foto + IA:** captura completa em <30 segundos por pacote, sem digitação.
- **Auditoria completa:** cada evento (chegada, organização, retirada) tem timestamp automático e responsável registrado.
- **Código de retirada Mercado Livre integrado:** morador envia o código pelo WhatsApp do sistema antes da entrega, e ele aparece automaticamente na tela do porteiro.

### 1.4 Não-objetivos do MVP (out-of-scope explícito)

- Aplicativo nativo (iOS/Android) — PWA atende.
- Validação biométrica/documento na retirada — confiança via posse do QR Code.
- Integração com câmeras IP/CFTV.
- Cobrança/billing automatizado de assinatura — manual no piloto.
- Multi-idioma — pt-BR apenas.
- Auto-cadastro de morador via WhatsApp — entra no roadmap pós-piloto.
- Dashboard com KPIs, gráficos, relatórios — apenas lista filtrável no MVP.
- Marca própria (número WhatsApp dedicado por condomínio) — feature premium futura.
- Integração com API de rastreio dos Correios.

---

## 2. Personas

### 2.1 Porteiro / Funcionário da portaria
- **Perfil:** ensino médio, baixa familiaridade com tecnologia, usa o celular do trabalho ou pessoal.
- **Contexto de uso:** em pé na portaria, pressa entre entregadores, conexão wifi instável.
- **Necessita:** UI simples, botões grandes, fluxo linear, mensagens de erro claras.
- **Sucesso:** registra um pacote em <30 segundos sem precisar pensar.

### 2.2 Administrador / Síndico
- **Perfil:** maior familiaridade com tecnologia, usa pelo desktop ou celular.
- **Contexto de uso:** sentado no escritório, revisando histórico, resolvendo reclamações.
- **Necessita:** lista filtrável, busca rápida por morador/unidade, histórico completo de cada pacote.
- **Sucesso:** responde "onde está meu pacote?" em <10 segundos.

### 2.3 Morador
- **Perfil:** todos os perfis (jovem a idoso), única exigência é ter WhatsApp.
- **Contexto de uso:** recebe notificação no celular pessoal a qualquer momento.
- **Necessita:** mensagem clara, QR code visível, sem necessidade de cadastro.
- **Sucesso:** entende em 5 segundos que o pacote chegou, vai retirar com o QR.

### 2.4 Fundador / Operador SaaS (Gustavo)
- **Contexto de uso:** ativa novos condomínios, monitora saúde do sistema, atende suporte.
- **Necessita:** onboarding rápido de condomínio, observabilidade, baixo overhead operacional.
- **Sucesso:** ativa novo condomínio em <1 hora, mantém o sistema com <2h/semana de operação.

---

## 3. Requisitos Funcionais (FR)

### 3.1 Cadastros

- **FR-001:** Sistema deve permitir cadastro de **condomínio** (nome, endereço, CEP, CNPJ, contato responsável). **Inclui flag `tem_administracao` (boolean)** definida na criação — pode ser alterada depois pelo admin do condomínio. Ver §3.8.
- **FR-002:** Sistema deve permitir cadastro de **setores de armazenamento** por condomínio (nome, descrição, capacidade opcional).
- **FR-002.1:** Sistema deve permitir cadastro de **blocos/torres** por condomínio (nome, descrição, ordem). Em prédios de bloco único, é opcional. Apartamentos vinculam-se a um bloco quando existir.
- **FR-003:** Sistema deve permitir cadastro de **unidades/apartamentos**, cada uma vinculada a um condomínio e opcionalmente a um bloco.
- **FR-004:** Cada unidade deve ter um **condômino principal** (nome, telefone, e-mail opcional). Esse é o destinatário fallback de notificações.
- **FR-005:** Cada unidade pode ter **destinatários adicionais** (nome, telefone opcional) — cônjuge, filhos, dependentes.
- **FR-006:** Sistema deve permitir **importação em massa via CSV** de unidades + condômino principal (ativação rápida de condomínio novo).
- **FR-007:** Sistema deve permitir **cadastro manual unitário** (uma unidade por vez via formulário web) para correções e adições.
- **FR-008:** Validação no CSV: telefones em formato BR válido, unidades sem duplicatas dentro do mesmo condomínio.

### 3.2 Chegada do pacote (portaria)

- **FR-010:** Funcionário deve poder iniciar o registro de pacote pelo celular (PWA mobile-first).
- **FR-011:** Sistema deve permitir **bipar o código de barras** do pacote (1D ou QR) usando a câmera do celular — opcional, serve para unicidade e rastreio.
- **FR-012:** Sistema deve **obrigatoriamente capturar uma foto da etiqueta** do pacote.
- **FR-013:** Sistema deve enviar a foto para pipeline de IA (Gemini Flash-Lite default + Anthropic Haiku 4.5 fallback, ambos vision) e extrair em JSON estruturado: nome do destinatário, endereço, CEP, complemento (apto/bloco), transportadora.
- **FR-014:** Sistema deve **sempre exibir os dados extraídos para confirmação/edição** antes de gravar (decisão MVP — modo "sempre confirmar").
- **FR-015:** Sistema deve sugerir automaticamente o casamento com a unidade baseado em **apto + bloco + nome do destinatário**. CEP entra apenas como sanity check (alerta visual se divergir, não bloqueia). Razão: em prédios de múltiplos blocos, CEP é o mesmo para todos.
- **FR-016:** Funcionário deve classificar o **tamanho do pacote** (Pequeno, Médio, Grande, Extra Grande) após confirmar os dados.
- **FR-017:** Sistema deve sugerir um **setor de armazenamento** com base no tamanho (regra simples e configurável por condomínio).
- **FR-018:** Funcionário deve poder **sobrescrever** a sugestão de setor e informar **posição** específica.
- **FR-019:** Sistema deve registrar **horário de chegada automático** (timestamp do servidor no momento do registro), nunca digitado manualmente.
- **FR-020:** Sistema deve registrar **funcionário responsável pelo recebimento** (capturado via login).
- **FR-021:** Se o matching automático falhar, o pacote deve cair em status **"pendente de identificação"** com os dados que a IA conseguiu extrair preservados. Resolução é aberta a porteiro **OU** admin (qualquer um que tiver tempo primeiro).
- **FR-022:** Em condomínio com `tem_administracao=true` (§3.8), porteiro **não escolhe setor + posição**. Após confirmar morador e tamanho, status vira `aguardando_organizacao` e pacote sai da fila do porteiro pra fila da administração. Em condomínio sem administração, fluxo segue como FR-016 a FR-018 (porteiro faz tudo).

### 3.3 Notificação ao morador

- **FR-030:** Após o pacote ser **organizado (setor + posição definidos)**, sistema deve **disparar notificação WhatsApp automaticamente**. Em condomínio com administração, gatilho é a confirmação da admin; sem administração, é o porteiro confirmando.
- **FR-031:** Notificação deve casar destinatário pela seguinte prioridade: (1) **nome da etiqueta** se houver morador cadastrado com nome equivalente (match exato → fuzzy ≥0.7 → primeiro+último nome); (2) **condômino principal**; (3) **primeiro adicional** com telefone.
- **FR-032:** Se ninguém na unidade tem telefone cadastrado, mensagem fica em estado `failed` com `failure_reason: 'sem_destinatario_telefone'` e admin é notificado pra cadastrar telefone (não retenta automaticamente).
- **FR-033:** Mensagem deve conter: nome do condomínio em destaque, nome do morador, aviso de chegada, setor de retirada, **QR Code único** (imagem).
- **FR-034:** QR Code **não expira** — vale até ser usado.
- **FR-035:** Sistema deve usar templates Meta aprovados (categoria utility), com variáveis para nome do condomínio, nome do morador, setor.
- **FR-036:** Sistema deve registrar status de entrega do WhatsApp (sent / delivered / read / failed) via webhook Meta.
- **FR-037:** Em caso de falha de envio, sistema deve tentar reenvio automático até 3 vezes com backoff exponencial.

### 3.4 Retirada do pacote

- **FR-040:** Funcionário deve poder iniciar a retirada escaneando o QR Code apresentado pelo morador.
- **FR-041:** Sistema deve identificar o pacote correspondente e exibir: foto da etiqueta, nome do destinatário, unidade, setor + posição.
- **FR-042:** Sistema deve perguntar: **"O próprio destinatário está retirando?"** (Sim/Não).
- **FR-043:** Se "Sim", registro automático em nome do destinatário.
- **FR-044:** Se "Não", funcionário deve digitar **nome da pessoa que está retirando** (texto livre).
- **FR-045:** Sistema deve registrar **horário de retirada automático** e **funcionário responsável pela entrega**.
- **FR-046:** Após confirmar retirada, status do pacote vira "retirado" e ele sai da lista de pendentes.
- **FR-047:** Sistema deve **invalidar o QR Code** após uso (não permitir segunda retirada).

### 3.5 Palavra-chave de entrega (via WhatsApp)

> **Contexto operacional:** Mercado Livre (e algumas plataformas) exige uma "palavra-chave" pra entregador deixar o pacote. Sem ela, entregador vai embora. Quando morador não está em casa, porteiro precisa saber a palavra-chave. Esse fluxo resolve isso.

- **FR-050:** Morador **cadastrado** deve poder enviar palavra-chave pelo WhatsApp do sistema escrevendo livremente (ex: "Palavra-chave 1234, liquidificador").
- **FR-051:** Sistema deve usar IA leve (regex primeiro, LLM fallback) para extrair: palavra-chave, descrição opcional do pedido.
- **FR-052:** Sistema deve identificar o morador remetente pelo número de telefone (lookup cross-tenant). Se telefone **não cadastrado**, sistema responde com template padrão: "Apenas moradores cadastrados podem enviar palavras-chave. Procure o síndico do seu prédio pra cadastrar seu telefone." Mensagem fica registrada pra audit, mas sem vínculo a apartamento.
- **FR-053:** Sistema deve responder no WhatsApp confirmando o recebimento ("Recebemos sua palavra-chave 1234. Vai aparecer pra portaria quando o entregador pedir.").
- **FR-054:** Tela `/portaria/palavras-chave` deve listar palavras-chave pendentes do condomínio com filtros (apartamento, bloco, morador, data). **Sempre acessível ao porteiro** (rota principal). Admin tem aba de visualização também (read-only).
- **FR-054.1:** Fluxo de uso na portaria: (1) entregador pergunta palavra-chave; (2) porteiro abre `/portaria/palavras-chave`; (3) busca por apto+bloco; (4) lê pro entregador; (5) entregador deixa o pacote; (6) porteiro faz fluxo normal de chegada — ao registrar pacote, sistema sugere vincular palavra-chave automaticamente.
- **FR-055:** Quando porteiro registra pacote pra morador com palavras-chave pendentes, sistema deve mostrar **banner sugerindo vinculação** ("Tem 2 palavras-chave pendentes pra esse apto, vincular?").
- **FR-056:** Palavras-chave não consumidas expiram em **30 dias** (cron diário).

### 3.6 Painel administrativo (mínimo no MVP)

- **FR-060:** Admin deve poder ver **lista de todos os pacotes** do seu condomínio (ativos + retirados).
- **FR-061:** Lista deve permitir **filtros**: status (pendente/aguardando retirada/retirado/pendente identificação), unidade, morador, período de chegada.
- **FR-062:** Lista deve permitir **busca textual** por nome de morador ou número de unidade.
- **FR-063:** Cada pacote na lista deve abrir um **detalhe** mostrando histórico completo: foto etiqueta, dados extraídos, horário de chegada, funcionário recebedor, setor + posição, horário de retirada, nome de quem retirou, funcionário entregador, status WhatsApp.
- **FR-064:** Admin deve poder **resolver manualmente pacotes "pendente de identificação"** (escolher unidade/morador correto).
- **FR-065:** Admin deve poder **gerenciar cadastros** (unidades, moradores, setores) via interface web.

### 3.7 Multi-tenancy (operação SaaS)

- **FR-070:** Sistema deve isolar **completamente** os dados entre condomínios (nenhum dado de um condomínio visível para outro).
- **FR-071:** Operador SaaS (Gustavo) deve ter visão "super admin" para criar novos condomínios e impersonar usuários para suporte.
- **FR-072:** Cada usuário (porteiro/admin) é vinculado a **um único condomínio**.
- **FR-073:** Sistema usa **número WhatsApp único compartilhado** entre todos os condomínios (modelo Meta Cloud API direto).
- **FR-074:** Mensagens devem injetar nome do condomínio como variável do template para dar contexto ao morador.
- **FR-075:** Roteamento de respostas WhatsApp (palavras-chave) deve identificar o morador pelo telefone do remetente.

### 3.8 Hierarquia operacional (admin master + admin funcionário + porteiro)

> **Contexto:** alguns condomínios têm equipe administrativa dedicada (síndico + secretária); outros são operados só pela portaria. O fluxo do app muda dependendo disso.

**Roles:**

- **`super_admin`** (operador SaaS — fora do condomínio)
- **`admin_master`** (síndico ou administrador-geral do prédio): cadastros completos, configura estrutura, gerencia usuários, vê tudo
- **`admin_funcionario`** (secretária administrativa, zelador da admin): operacional na admin — organiza pacotes em condomínio com administração + entrega aos moradores
- **`porteiro`** (funcionário da portaria): recebe entregadores + (em condomínio sem administração) organiza pacotes

**FR-080 — Toggle `condominio.tem_administracao`:**
- Definido na criação do condomínio pelo super-admin (checkbox no formulário)
- Pode ser alterado depois pelo admin_master em "Configurações do condomínio"
- Quando `true`: porteiro recebe → admin organiza → admin dispara WhatsApp → entrega normal no QR
- Quando `false`: porteiro faz tudo (fluxo atual)

**FR-081 — Status `aguardando_organizacao`:**
- Novo status entre `confirmado` e `aguardando_retirada`
- Pacote em `aguardando_organizacao` aparece em `/administracao/organizar` (só `admin_*` enxergam)
- Transição automática quando porteiro confirma morador em condomínio com `tem_administracao=true`

**FR-082 — Rota administração (`em_administracao`):**
- Status adicional aplicável depois de `aguardando_retirada`: pacote sai da portaria, vai pra admin (caso morador esteja viajando, doente, pacote grande etc).
- Trigger: botão "Enviar pra administração" no detalhe do pacote — disponível pra porteiro e admin_master.
- Pacote some da fila portaria, aparece em `/administracao/em-transito`.
- admin_funcionario entrega ao morador → status `retirado`.

**FR-083 — Bipe entrega final flexível:**
- **Qualquer role operacional pode bipar a entrega final** (porteiro, admin_funcionario, admin_master).
- Razão: flexibilidade — se admin estiver fora, porteiro entrega; se admin estiver disponível, admin entrega.
- Audit log diferencia quem finalizou.
- Quando porteiro escaneia QR de pacote em `em_administracao`, sistema avisa "Este pacote estava na administração — confirma entrega?" e prossegue.

**FR-084 — CRUD usuários hierárquico:**
- super_admin: cria/edita admin_master de qualquer condomínio + ativa/desativa condomínios
- admin_master: cadastra/edita/desativa **admin_funcionario** e **porteiro** do mesmo condomínio
- admin_funcionario: não tem CRUD de usuário
- porteiro: não tem CRUD de usuário

**FR-085 — Resolução de pendentes flexível:**
- Pacotes em `pendente_identificacao` podem ser resolvidos por **porteiro OU admin** (qualquer um disponível).

### 3.9 Lembretes operacionais (placeholder — a definir)

- **FR-090:** Sistema deve enviar **lembrete WhatsApp ao morador** se pacote não for retirado em **24h após primeira notificação**. Texto e cadência a definir em iteração com primeiros pilotos.
- **FR-091:** Sistema deve **expirar palavras-chave** não-consumidas após 30 dias (já em FR-056).
- **FR-092:** Admin deve poder **cancelar pacote** com motivo (texto livre + razão estruturada). Pacote vai pra status `cancelado` com audit log. Decisão de produto a finalizar: cancelados aparecem na lista? Reabrir cancelados é permitido?

### 3.10 Busca e filtros (operacional admin)

- **FR-100:** Header admin deve ter **busca global** (atalho `⌘K` / `Ctrl+K`) que pesquisa em: nome de morador, telefone de morador, código de rastreio de pacote, identificador de unidade. Resultados em dropdown com link direto pro detalhe.
- **FR-101:** Listas em `/admin/*` devem ter filtros padronizados: status, bloco/torre, período, busca textual. Padrão de UI consistente entre listas.
- **FR-102:** Tela `/admin/blocos` deve apresentar **hierarquia visual**: lista de blocos/torres → drill down nos apartamentos → moradores. Substitui terminologia "Unidades" no menu lateral por **"Torres/Blocos"**.

### 3.11 Audit log abrangente

- **FR-110:** Toda operação sensível deve gerar entrada em `audit_log` com: ator (`user_id`), timestamp, ação, recurso afetado, condomínio, payload de mudança (before/after diff quando aplicável).
- **FR-111:** Operações cobertas obrigatoriamente: login, criação/edição/desativação de condomínio/setor/bloco/unidade/morador/usuário, organização/retirada/cancelamento/reenvio de pacote, configuração de webhook, mudança de role, envio/recebimento WhatsApp.
- **FR-112:** UI `/super-admin/audit` permite filtros por: ator, ação, recurso, período, condomínio. super_admin vê tudo; admin_master vê só do próprio condomínio.

### 3.12 Dashboard super-admin

- **FR-120:** Página `/super-admin` deve mostrar KPIs cross-tenant: total de **condomínios ativos**, total de **admins ativos**, total de **pacotes pendentes nas últimas 24h**, total de **usuários ativos** separados em colunas (admins vs porteiros).
- **FR-121:** Super-admin deve poder **desativar/reativar** condomínio (soft delete `condominio.ativo`). Desativação bloqueia login dos users vinculados + remove da lista geral; reativação reverte.

---

## 4. Requisitos Não-Funcionais (NFR)

### 4.1 Performance
- **NFR-001:** Tempo de processamento de etiqueta pela IA: <5 segundos (P95).
- **NFR-002:** Tempo total de registro de pacote (bipe → confirmação → setor): <30 segundos (P95).
- **NFR-003:** Tempo de envio de notificação WhatsApp: <10 segundos após confirmação do setor (P95).
- **NFR-004:** Painel admin lista 1000 pacotes: <2 segundos para carregar (P95).

### 4.2 Disponibilidade
- **NFR-010:** Uptime alvo: 99% no MVP (downtime aceitável: ~7h/mês).
- **NFR-011:** Backup automático do banco PostgreSQL: diário, retenção 30 dias.
- **NFR-012:** Recovery Point Objective (RPO): máximo 24h de perda em catástrofe.

### 4.3 Segurança
- **NFR-020:** Senhas de usuários armazenadas com bcrypt (cost ≥12).
- **NFR-021:** Sessões via JWT com expiração 7 dias.
- **NFR-022:** Comunicação 100% HTTPS (Let's Encrypt + Caddy/Nginx).
- **NFR-023:** Isolamento multi-tenant via `condominio_id` em todas as queries (Row-Level Security ou middleware aplicacional).
- **NFR-024:** Webhooks Meta validados por assinatura HMAC.
- **NFR-025:** Fotos de etiqueta armazenadas com controle de acesso (URL assinada, expiração 1h).

### 4.4 LGPD
- **NFR-030:** Termo de uso e política de privacidade aceitos no cadastro do morador (CSV import = condomínio declara ter consentimento).
- **NFR-031:** Direito de exclusão: admin pode deletar morador, sistema anonimiza histórico de pacotes desse morador (não apaga registros, substitui nome por "[removido]").
- **NFR-032:** Dados sensíveis no termo: nome, telefone, endereço, CPF não é coletado.
- **NFR-033:** Logs de acesso e auditoria retidos por 12 meses.

### 4.5 Custos operacionais (alvo MVP)
- **NFR-040:** Custo total variável por condomínio: <R$ 25/mês (WhatsApp + IA + VPS rateada).
- **NFR-041:** Custo de IA por etiqueta: <R$ 0,05 (com prompt caching).
- **NFR-042:** Custo de WhatsApp por notificação utility: <R$ 0,05.

### 4.6 Usabilidade
- **NFR-050:** Interface da portaria: zero treinamento — operável por qualquer pessoa em <2 minutos de exposição.
- **NFR-051:** Suporte a câmera traseira do celular para bipe e foto.
- **NFR-052:** PWA instalável (Add to Home Screen) com ícone próprio.
- **NFR-053:** Funciona offline para visualizar lista? **Não no MVP** — operação é sempre online.

---

## 5. Restrições (CON)

- **CON-001:** Stack obrigatória: Next.js 16 + PostgreSQL 16 + Prisma + Redis + Docker.
- **CON-002:** Hospedagem obrigatória: VPS Hostinger KVM 2 (decisão fechada).
- **CON-003:** WhatsApp via **Meta Cloud API direto, sem BSP**, no MVP.
- **CON-004:** LLM obrigatório: **Anthropic Claude Haiku 4.5** com prompt caching (não usar GPT/Gemini).
- **CON-005:** Modelo de WhatsApp: **número único compartilhado multi-tenant**.
- **CON-006:** Templates Meta limitados ao que for aprovado (não dá pra mandar mensagem livre fora da janela 24h).
- **CON-007:** Limite Meta Tier 1 inicial: 1.000 destinatários únicos / 24h (suficiente pro piloto).

---

## 6. Estrutura de Épicos (alto nível)

> **Status atual (2026-05-19):** Epics 1-6 (MVP) concluídos. Epics 7-12 (pós-MVP) em progresso. Detalhe e progresso no [`docs/stories/ROADMAP.md`](../stories/ROADMAP.md).

| Epic | Nome | Status |
|------|------|--------|
| **E1** | Fundação técnica | ✅ Concluído |
| **E2** | Cadastros | ✅ Concluído |
| **E3** | Chegada do pacote | ✅ Concluído |
| **E4** | Notificação WhatsApp | ✅ Concluído (aguarda aprovação template Meta + chip dedicado pra prod real) |
| **E5** | Retirada do pacote | ✅ Concluído |
| **E6** | Painel administrativo | ✅ Concluído |
| **E7** | Palavra-chave de entrega via WhatsApp (FR-050 a FR-056) | 🟡 Parcial (7.1, 7.5 done; 7.2-7.4, 7.6 draft) |
| **E8** | Operação SaaS — primeira fase (super-admin, impersonate, audit base, equipe) | ✅ Concluído (8.1-8.7 done) |
| **E10** | Hierarquia operacional (FR-080 a FR-085) — admin_master + admin_funcionario + rota administração | ✅ Concluído (10.1-10.7 done) |
| **E11** | UX admin refinado (FR-100 a FR-102) — Torres/Blocos + busca global Cmd+K + filtros | ✅ Concluído (11.1-11.5 done) |
| **E12** | Operação SaaS madura (ex-E9, FR-110 a FR-121) — dashboard, audit abrangente, governança | 🟡 Parcial (12.1-12.4 done; 12.5-12.6 draft) |

**Sequência executada pós-MVP:** E10 → E11 → E8 → E12 (parcial) → E7 (parcial). Próximos: E12.5-12.6 (UI audit) → E7 restante.

---

## 7. Templates WhatsApp a submeter para a Meta

Necessário aprovar antes do MVP entrar em produção:

### 7.1 Template `pacote_chegou` (utility) — APROVAÇÃO EM ANÁLISE NA META
```
Olá {{1}}! Sua encomenda chegou no {{2}} e já está disponível na portaria.
Mostre a imagem em anexo ao porteiro para a retirada.
```
- `{{1}}` = nome do morador
- `{{2}}` = nome do condomínio
- **Header:** imagem (QR Code 1200×628 com nome do condomínio)
- **Submetido em:** 2026-05-08 16h25 — categoria Utility, idioma pt_BR

### 7.2 Template `palavra_chave_recebida` (utility / resposta — story 7.x)
```
Recebemos sua palavra-chave: *{{1}}*

Vai ficar disponível pra portaria assim que o entregador pedir. Não precisa fazer mais nada agora.
```

### 7.2.1 Template `morador_nao_cadastrado` (utility / resposta — story 7.x)
```
Olá! Apenas moradores cadastrados no sistema podem enviar palavras-chave de entrega.
Procure o síndico do seu prédio pra cadastrar seu telefone.
```

### 7.3 Template `pacote_retirado` (utility — opcional, decisão futura)
```
[{{1}}] Confirmado! 

Seu pacote foi retirado em {{2}} por {{3}}. Obrigado!
```

### 7.4 Template `lembrete_pacote_pendente` (utility — opcional, roadmap)
```
[{{1}}] Olá {{2}}, lembrete amigável: seu pacote chegou no dia {{3}} e ainda está aguardando retirada em {{4}}.
```

---

## 8. Métricas de sucesso do piloto

### 8.1 Métricas operacionais
- **% de pacotes registrados com sucesso na primeira tentativa** (sem erro de IA, sem fallback manual): **alvo ≥85%**
- **Tempo médio de registro de pacote** (bipe → notificação enviada): **alvo <60 segundos**
- **Taxa de match automático IA com cadastro**: **alvo ≥80%**
- **Taxa de notificações WhatsApp entregues (delivered)**: **alvo ≥95%**

### 8.2 Métricas de adoção
- **% de pacotes retirados via QR Code** (vs. retirada "manual" sem QR): **alvo ≥90%**
- **Tempo médio entre chegada e retirada**: **diminuir 30%** vs. baseline manual
- **Quantidade de extravios reportados**: **zero** durante o piloto

### 8.3 Métricas de produto
- **NPS do síndico/admin no fim do piloto**: **alvo ≥8**
- **NPS do morador (pesquisa via WhatsApp)**: **alvo ≥8**
- **Disposição de pagar mensalidade alvo (R$ 199-299)**: **alvo: 2 dos 3 pilotos convertem em pagantes**

### 8.4 Critérios de Go/No-Go pós-piloto
**GO para escala se:** ≥80% das métricas operacionais atingidas + ≥1 piloto convertido pagante + nenhum bug crítico não-resolvido.
**NO-GO / iterar:** caso contrário, retorno ao roadmap com aprendizados e ajustes.

---

## 9. Plano de piloto

### 9.1 Critérios de seleção dos condomínios piloto
- 50-200 unidades (sweet spot: nem pequeno demais pra não ter volume, nem grande demais pra complicar).
- Síndico/admin engajado e disposto a dar feedback semanal.
- Volume estimado de pacotes: ≥10/dia.
- Aceita assinar termo de piloto (uso gratuito por 60 dias em troca de feedback estruturado).

### 9.2 Cronograma do piloto
- **Semana 1:** ativação técnica (cadastros, treinamento porteiro 1h, instalação PWA nos celulares).
- **Semanas 2-4:** operação supervisionada (Gustavo monitora diariamente, ajustes finos).
- **Semanas 5-8:** operação autônoma com checkpoint semanal.
- **Semana 8:** retrospectiva + decisão Go/No-Go.

### 9.3 Quantidade de pilotos
- **Mínimo:** 1 condomínio (validação técnica).
- **Ideal:** 3 condomínios em paralelo (validação de multi-tenancy + diversidade de cenários).
- **Máximo no MVP:** 5 condomínios (capacidade técnica sem stress).

---

## 10. Decisões registradas e seus motivos

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Stack | Next.js + PG + Prisma + Redis + Docker | Maturidade, mercado de devs, evolução para nativo trivial |
| Hospedagem | Hostinger KVM 2 | Suporte 24/7 PT-BR, NF brasileira, custo controlado |
| WhatsApp provider | Meta Cloud API direto | Free tier real, oficial, sem markup BSP, migração trivial futura |
| Modelo WhatsApp | Número único multi-tenant | Onboarding instantâneo, custo baixo, branding por mensagem |
| LLM | Claude Haiku 4.5 | Custo baixíssimo (~R$ 0,02/etiqueta), qualidade vision adequada |
| Cadastro morador | CSV + manual unitário | Flexibilidade na ativação + correções pontuais |
| Confirmação IA | Sempre confirmar | Segurança no MVP, calibração de modelo só depois com dados reais |
| Painel admin | Mínimo (lista + filtros) | Acelera ship do MVP, dashboard entra pós-piloto |

---

## 11. Riscos identificados

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Verificação Meta Business demora >7 dias | Média | Alto (bloqueia piloto) | Iniciar verificação imediatamente em paralelo ao dev |
| LLM erra muito em etiquetas Magalu/condomínio | Média | Médio | Confirmação obrigatória + coletar mais etiquetas para benchmark |
| Porteiro resiste à mudança e volta pro caderno | Alta | Alto | Treinamento presencial + UX simplíssima + acompanhamento próximo |
| Síndico não importa CSV correto | Alta | Médio | Template CSV claro + validação rigorosa + suporte na ativação |
| Quality rating Meta cai e bloqueia número | Baixa | Crítico | Templates bem escritos + monitoramento ativo + canal alternativo backup |
| Hostinger trava VPS sem aviso | Baixa | Alto | Backup diário externo + plano de migração documentado |
| LGPD: condomínio importa morador sem consentimento | Média | Alto | Termo no CSV import + documentação clara + responsabilidade contratual no condomínio |

---

## 12. Próximos passos

1. **`@architect` (Aria):** receber este PRD e produzir o documento de arquitetura técnica detalhada (componentes, contratos de API, estrutura de pastas, deploy, multi-tenancy, integrações).
2. **`@data-engineer` (Dara):** modelar o schema PostgreSQL completo a partir dos FRs.
3. **`@ux-design-expert` (Uma):** prototipar telas mobile-first (chegada, confirmação IA, organização, retirada, painel).
4. **`@sm` (River):** quebrar cada épico em stories de implementação.
5. **`@po` (Pax):** validar cada story (10-point checklist).
6. **`@dev` (Dex):** implementar.
7. **`@qa` (Quinn):** quality gates por story.
8. **`@devops` (Gage):** setup VPS Hostinger, CI/CD, deploy, monitoramento.

**Em paralelo (ações do fundador):**
- Assinar Hostinger KVM 2.
- Criar Meta Business Manager + iniciar verificação (3-7 dias).
- Comprar chip dedicado.
- Criar conta Anthropic Console + API key.
- Identificar e abordar 1-3 condomínios candidatos a piloto.
