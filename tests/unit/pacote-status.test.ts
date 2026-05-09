/* @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { PacoteStatus } from '@prisma/client';

/**
 * Story 10.2: garante que os 2 novos status estão expostos pelo Prisma client
 * gerado, podem ser referenciados em código TypeScript, e mantêm os existentes.
 */
describe('PacoteStatus enum (story 10.2)', () => {
  it('inclui status legados', () => {
    expect(PacoteStatus.rascunho).toBe('rascunho');
    expect(PacoteStatus.pendente_identificacao).toBe('pendente_identificacao');
    expect(PacoteStatus.aguardando_retirada).toBe('aguardando_retirada');
    expect(PacoteStatus.retirado).toBe('retirado');
    expect(PacoteStatus.cancelado).toBe('cancelado');
  });

  it('inclui aguardando_organizacao (Epic 10 — fluxo bifurcado)', () => {
    expect(PacoteStatus.aguardando_organizacao).toBe('aguardando_organizacao');
  });

  it('inclui em_administracao (Epic 10 — rota administração)', () => {
    expect(PacoteStatus.em_administracao).toBe('em_administracao');
  });

  it('total de 7 status no enum', () => {
    expect(Object.keys(PacoteStatus)).toHaveLength(7);
  });
});
