/* @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';

/**
 * Story 11.1 (Epic 11): valida que o Prisma client expõe o model Bloco
 * e que Unidade ganhou bloco_id (FK opcional).
 */
describe('Bloco schema (story 11.1)', () => {
  it('Prisma DMMF expõe model Bloco', () => {
    const blocoModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Bloco');
    expect(blocoModel).toBeDefined();
    expect(blocoModel?.fields.find((f) => f.name === 'nome')?.type).toBe('String');
    expect(blocoModel?.fields.find((f) => f.name === 'condominio_id')?.type).toBe('String');
    expect(blocoModel?.fields.find((f) => f.name === 'ordem')?.type).toBe('Int');
  });

  it('Unidade ganha bloco_id como FK opcional', () => {
    const unidadeModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Unidade');
    const blocoIdField = unidadeModel?.fields.find((f) => f.name === 'bloco_id');
    expect(blocoIdField).toBeDefined();
    expect(blocoIdField?.isRequired).toBe(false);
    expect(blocoIdField?.type).toBe('String');
  });

  it('campo legacy unidade.bloco preservado pra rollback', () => {
    const unidadeModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Unidade');
    const blocoField = unidadeModel?.fields.find((f) => f.name === 'bloco');
    expect(blocoField).toBeDefined();
    expect(blocoField?.type).toBe('String');
  });
});
