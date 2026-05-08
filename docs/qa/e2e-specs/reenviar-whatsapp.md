# E2E Spec — Reenviar Notificação WhatsApp (story 4.6)

> **Status:** Spec documentado, **execução pendente** instalação de Playwright no projeto (registrado como infra débito separado do épico).
>
> Quando Playwright for instalado, transcrever este spec para `tests/e2e/reenviar-whatsapp.spec.ts`.

## Setup necessário

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

Criar `playwright.config.ts` apontando pra `tests/e2e/`, `baseURL: http://localhost:3000`, `webServer: { command: 'npm run dev', port: 3000 }`.

Fixture necessário: usuário admin autenticado via Clerk + pacote em status `aguardando_retirada` no DB de teste.

## Casos de teste

### 1. Caminho feliz — admin clica Reenviar e mensagem aparece em `pending`

**Given:** admin logado, pacote `P1` em `aguardando_retirada`, sem mensagens WhatsApp (ou última `failed`)
**When:** admin acessa `/admin/pacotes/P1`, clica em **Reenviar**
**Then:**
- Toast "Notificação reenfileirada — atualize em alguns segundos"
- Após `router.refresh()`, lista contém nova entry com badge **Pendente**
- Telefone aparece mascarado (`5511…1234`)

```ts
await page.goto('/admin/pacotes/P1');
await page.getByRole('button', { name: /Reenviar/i }).click();
await expect(page.getByText('reenfileirada')).toBeVisible();
await expect(page.getByText(/Pendente/i)).toBeVisible();
```

### 2. Rate limit — 4ª chamada em <1h retorna 429 + toast claro

**Given:** pacote já com 3 mensagens criadas em <1h
**When:** admin clica Reenviar pela 4ª vez
**Then:**
- Response API: 429
- Toast vermelho: "Limite de 3 reenvios/hora atingido"
- Lista não ganha nova entry

### 3. Pacote já retirado — botão NÃO aparece

**Given:** pacote `P2` em status `retirado`
**When:** admin acessa `/admin/pacotes/P2`
**Then:** seção "Notificações WhatsApp" visível, mas botão Reenviar **ausente**

### 4. Última mensagem `delivered` — botão NÃO aparece

**Given:** pacote `P3` em `aguardando_retirada`, última mensagem `status: delivered`
**When:** admin acessa detalhe
**Then:** badge **Entregue**, botão Reenviar **ausente** (sucesso confirmado, sem motivo pra reenviar)

### 5. matched_by ≠ nome_etiqueta exibe badge informativo

**Given:** pacote com mensagem `template_params.matched_by = 'principal'`
**When:** admin abre detalhe
**Then:** texto "Destinatário escolhido condômino principal (fallback)" visível na entry

### 6. Falha de rede — toast erro, sem refresh

**Given:** rede simulada offline
**When:** admin clica Reenviar
**Then:** toast "Falha de rede ao reenviar"; lista inalterada

## Cobertura via tests unit (já implementados)

Story 4.6b inclui `tests/unit/whatsapp-notifications-block.test.tsx` com 8 tests cobrindo cenários 1-6 acima via React Testing Library + jsdom + fetch mockado. **Os tests unit cobrem comportamento de UI**; o E2E adicionaria validação ponta-a-ponta com DB+queue+API real, garantindo que o jobId determinístico não dedupliça e que o BullMQ realmente processa.

## Quando priorizar

- **Antes do piloto real:** sim, pelo menos cenários 1+2+3 (caminho feliz + rate limit + sem botão pra retirado)
- **Para escalar pós-piloto:** todos os 6 + smoke teste com Meta sandbox real (envia mensagem, valida webhook chega, status atualiza)
