/* @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { computeDiff } from '@/lib/audit/audited-mutation';

describe('computeDiff', () => {
  it('detects changed fields', () => {
    const before = { nome: 'Bloco A', ordem: 1, ativo: true };
    const after = { nome: 'Bloco B', ordem: 1, ativo: true };
    const diff = computeDiff(before, after);
    expect(diff.changed).toEqual(['nome']);
    expect(diff.before).toEqual({ nome: 'Bloco A' });
    expect(diff.after).toEqual({ nome: 'Bloco B' });
  });

  it('detects multiple changed fields', () => {
    const before = { nome: 'Setor 1', descricao: null, ativo: true };
    const after = { nome: 'Setor 2', descricao: 'Desc', ativo: false };
    const diff = computeDiff(before, after);
    expect(diff.changed).toContain('nome');
    expect(diff.changed).toContain('descricao');
    expect(diff.changed).toContain('ativo');
    expect(diff.changed).toHaveLength(3);
  });

  it('returns empty when no changes', () => {
    const obj = { nome: 'Test', ativo: true };
    const diff = computeDiff(obj, { ...obj });
    expect(diff.changed).toHaveLength(0);
    expect(diff.before).toEqual({});
    expect(diff.after).toEqual({});
  });

  it('ignores updated_at and created_at', () => {
    const before = { nome: 'A', updated_at: '2026-01-01', created_at: '2026-01-01' };
    const after = { nome: 'A', updated_at: '2026-01-02', created_at: '2026-01-01' };
    const diff = computeDiff(before, after);
    expect(diff.changed).toHaveLength(0);
  });

  it('handles nested objects via JSON comparison', () => {
    const before = { metadata: { x: 1 } };
    const after = { metadata: { x: 2 } };
    const diff = computeDiff(before, after);
    expect(diff.changed).toEqual(['metadata']);
    expect(diff.before).toEqual({ metadata: { x: 1 } });
    expect(diff.after).toEqual({ metadata: { x: 2 } });
  });

  it('detects new fields added', () => {
    const before = { nome: 'A' };
    const after = { nome: 'A', descricao: 'nova' };
    const diff = computeDiff(before, after);
    expect(diff.changed).toEqual(['descricao']);
    expect(diff.before).toEqual({ descricao: undefined });
    expect(diff.after).toEqual({ descricao: 'nova' });
  });
});
