# Proximas Features — Analise Pos-Competitiva

Data: 2026-05-19
Status: Aprovado para roadmap. Prioridade a definir com equipe.

## Contexto

Apos analise competitiva detalhada (Minha Encomenda, e-Condominio, Condfy, uCondo, Seu Condominio),
identificamos funcionalidades que tornariam a escolha pelo PONTO24 **obvia** frente a concorrencia.

Documento de referencia: `docs/apresentacao-competitiva.html`

---

## Tier 1 — Fecha venda sozinho (alto impacto)

### 1. Dashboard de Metricas para o Sindico

**Esforco estimado:** ~3-4 dias
**Impacto na venda:** Altissimo

Funcionalidades:
- Pacotes recebidos/retirados por dia/semana/mes
- Tempo medio de retirada
- Ranking de unidades que mais recebem
- Horario de pico na portaria
- Graficos visuais simples e claros

**Justificativa:** Sindico adora apresentar dados em assembleia. Nenhum concorrente direto
oferece dashboard de metricas dedicado a pacotes. Vira argumento de venda instantaneo.

**Concorrencia:** Nenhum dos 5 concorrentes analisados tem isso.

---

### 2. Foto do Pacote na Notificacao

**Esforco estimado:** ~1-2 dias
**Impacto na venda:** Alto

Funcionalidades:
- Porteiro tira foto do pacote no momento do registro
- Foto enviada no WhatsApp junto com o QR Code
- Prova visual do estado do pacote (evita reclamacao de dano)
- Foto armazenada no historico do pacote

**Justificativa:** Gera confianca. Morador sabe exatamente o que chegou e em que estado.
Util para disputas sobre pacotes danificados.

**Concorrencia:** Minha Encomenda nao tem. e-Condominio nao tem.

**Notas tecnicas:**
- Ja temos upload de foto (campo `foto_url` no schema)
- Precisa integrar com template WhatsApp (header image ja funciona — testado com QR)
- Avaliar compressao de imagem no client-side antes do upload

---

### 3. Escalacao de Lembretes

**Esforco estimado:** ~1 dia
**Impacto na venda:** Alto

Fluxo proposto:
- **24h** → lembrete ao morador (ja existe)
- **48h** → segundo lembrete ao morador
- **72h** → notifica o sindico/admin que tem pacote parado
- **7 dias** → alerta critico ao admin master

**Justificativa:** Resolve a dor real numero 1: pacotes acumulando na portaria por dias.
Nenhum concorrente faz escalacao automatica — apenas lembrete unico ou nenhum.

**Concorrencia:** Nenhum dos 5 concorrentes tem escalacao. Apenas nos temos lembrete 24h.

**Notas tecnicas:**
- Ja temos cron de lembrete 24h (Story 7.5)
- Expandir o cron para verificar 48h e 72h
- Adicionar campo de configuracao por condominio (sindico pode ajustar intervalos)

---

## Tier 2 — Diferenciacao clara (medio impacto)

### 4. Relatorio PDF Mensal Automatico

**Esforco estimado:** ~2 dias
**Impacto na venda:** Medio-alto

Funcionalidades:
- Gera PDF com logo do condominio no fim do mes
- Enviado automaticamente pro sindico por email ou WhatsApp
- Conteudo: total de pacotes, tempo medio, graficos simples, moradores com mais pacotes
- Exportavel manualmente a qualquer momento

**Justificativa:** Sindico usa na prestacao de contas em assembleia. Dado pronto = menos trabalho.
Nenhum concorrente gera relatorio automatico.

**Notas tecnicas:**
- Lib sugerida: `@react-pdf/renderer` ou `puppeteer` para gerar PDF server-side
- Agendar via BullMQ cron (dia 1 de cada mes)
- Template do PDF deve seguir identidade visual PONTO24

---

### 5. Multiplos Moradores por Unidade

**Esforco estimado:** ~1-2 dias
**Impacto na venda:** Medio

Funcionalidades:
- Pacote chega → notifica TODOS os moradores cadastrados na unidade
- Qualquer morador da unidade pode retirar com seu proprio QR
- Configuravel: morador principal + moradores adicionais

**Justificativa:** Realidade de familias. Se so avisa um morador e ele esta viajando,
pacote fica parado. Resolve caso de uso muito comum.

**Notas tecnicas:**
- Schema ja suporta multiplos moradores por unidade (relacao 1:N unidade→morador)
- Precisa ajustar logica de notificacao para enviar a todos da unidade, nao so ao "primeiro"
- QR de retirada deve identificar qual morador retirou

---

### 6. Tela Self-Service do Morador

**Esforco estimado:** ~2-3 dias
**Impacto na venda:** Medio

Funcionalidades:
- Morador acessa link (PWA) e ve: pacotes pendentes, historico, status
- Sem login complexo — acesso via link unico enviado no WhatsApp
- Pode marcar "estou viajando" (adia lembretes)
- Ve foto do pacote e dados da etiqueta

**Justificativa:** Reduz ligacao pra portaria ("chegou algo pra mim?"). Valoriza o morador
com transparencia. Diferencial frente a todos os concorrentes diretos.

**Notas tecnicas:**
- Rota publica com token unico por morador (sem Clerk)
- PWA leve, mobile-first
- Avaliar se integra no mesmo Next.js ou micro-frontend separado

---

## Tier 3 — Premium/Enterprise (futuro)

### 7. Modo Offline do Porteiro

**Esforco estimado:** ~4-5 dias
**Impacto na venda:** Medio (nicho)

- Registra pacotes mesmo sem internet
- Sincroniza quando conexao voltar
- Service Worker + IndexedDB para cache local

**Justificativa:** Portarias com WiFi instavel. Complexo de implementar mas relevante
para condominios grandes em regioes com infraestrutura precaria.

---

### 8. Integracao com Transportadoras

**Esforco estimado:** ~3-5 dias
**Impacto na venda:** Baixo-medio

- Codigo de rastreio extraido pela IA → tracking automatico
- Integracoes: Correios (API publica), Jadlog, Loggi
- Morador ve status do rastreio dentro do sistema

**Justificativa:** Legal mas nao e dor urgente. Pode ser diferencial premium.

---

## Resumo de Priorizacao

| # | Feature                      | Esforco   | Impacto Venda | Concorrentes tem? |
|---|------------------------------|-----------|---------------|-------------------|
| 1 | Dashboard metricas           | ~3-4 dias | Altissimo     | Nenhum            |
| 2 | Foto do pacote               | ~1-2 dias | Alto          | Nenhum            |
| 3 | Escalacao lembretes          | ~1 dia    | Alto          | Nenhum            |
| 4 | Relatorio PDF mensal         | ~2 dias   | Medio-alto    | Nenhum            |
| 5 | Multiplos moradores/unidade  | ~1-2 dias | Medio         | Parcial           |
| 6 | Tela self-service morador    | ~2-3 dias | Medio         | Nenhum            |
| 7 | Modo offline porteiro        | ~4-5 dias | Medio (nicho) | Nenhum            |
| 8 | Integracao transportadoras   | ~3-5 dias | Baixo-medio   | Nenhum            |

**Recomendacao:** Comecar por 2 (foto) + 3 (escalacao) por serem rapidos e de alto impacto,
depois 1 (dashboard) que e o maior diferencial comercial.

**Total Tier 1+2:** ~10-14 dias de desenvolvimento para 6 features que nenhum concorrente tem.

---

## Links dos Concorrentes (referencia)

- Minha Encomenda: https://minhaencomenda.app
- e-Condominio: https://econdominio.com.br
- Condfy: https://condfy.com.br
- uCondo: https://ucondo.com.br
- Seu Condominio: https://seucondominio.com.br

Analise completa: `docs/apresentacao-competitiva.html`
