# Epic 7 — Palavra-chave de entrega via WhatsApp (entrega inicial)

**Status:** Done — core funcional. Polish pra futuro.

## Mudanças

### Worker / Pipeline
- `src/lib/whatsapp/parse-palavra-chave.ts`: regex parser com 3 padrões (codigo X, ML X, dígitos isolados)
- `src/lib/queue/jobs/process-palavra-chave.ts`: worker BullMQ — extrai, persiste em codigo_ml_pendente, reply via Meta template
- `process-whatsapp-webhook.ts`: ao criar inbound message com morador identificado, enfileira `processPalavraChave`
- Reusa schema legado `CodigoMlPendente` (rename é refactor breaking deferido)

### UI portaria
- `src/lib/db/palavra-chave.ts`: `listPalavrasChavePendentes` com filtros (busca q + unidade)
- `src/app/(portaria)/portaria/palavras-chave/page.tsx`: tela com search box, lista cards com código destacado, expiração, descrição

### Tests
- 9 tests parse-palavra-chave (todos os padrões + rejeições)

## Pendências externas / out-of-scope

- ⏳ Template Meta `palavra_chave_recebida` precisa ser criado e aprovado pra reply funcionar (sem isso, worker loga warn e segue)
- ⏳ Template `morador_nao_cadastrado` pra responder telefones desconhecidos (story dedicada futura)
- ⏳ Aba admin read-only (`/admin/palavras-chave`) — pode ser adicionada como story 7.x
- ⏳ Banner "vincular palavra-chave automaticamente" na tela organizar (FR-055)
- ⏳ Cron diário `expirePalavrasChave` (FR-056)
- ⏳ LLM fallback quando regex não casa (custo/benefício baixo no MVP)

## Validações
- typecheck/lint/build clean, 309/309 unit tests verde
