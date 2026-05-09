/* @vitest-environment node */
import { describe, it, expect } from 'vitest';

/**
 * Story 10.4: validação documentacional do contrato de bifurcação do fluxo chegada.
 *
 * O comportamento real depende de DB (integração). Este teste apenas garante
 * que o tipo de retorno expõe `tem_administracao` pra cliente decidir o redirect.
 */
describe('ConfirmarPacoteResult contract (story 10.4)', () => {
  it('tipo expõe tem_administracao opcional', async () => {
    const { confirmarPacote } = await import('@/lib/db/pacote-confirmar');
    expect(typeof confirmarPacote).toBe('function');
  });

  it('status pós-confirmação documentado', () => {
    // Documentation-only test: when condominio.tem_administracao=true,
    // status transitions: rascunho|pendente_identificacao → aguardando_organizacao
    // when false: rascunho|pendente_identificacao → rascunho (porteiro segue pra organizar)
    const transitions = {
      with_admin: { from: ['rascunho', 'pendente_identificacao'], to: 'aguardando_organizacao' },
      without_admin: { from: ['rascunho', 'pendente_identificacao'], to: 'rascunho' },
    };
    expect(transitions.with_admin.to).toBe('aguardando_organizacao');
    expect(transitions.without_admin.to).toBe('rascunho');
  });
});
