/* @vitest-environment node */
import { describe, it, expect } from 'vitest';

// Test the diff rendering logic (pure functions, no React rendering)

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function classifyMetadata(meta: Record<string, unknown>) {
  const hasBefore = 'before' in meta;
  const hasAfter = 'after' in meta;

  if (hasBefore && hasAfter) return 'update';
  if (hasBefore && !hasAfter) return 'delete';
  if (!hasBefore && hasAfter) return 'create';
  return 'raw';
}

function getDiffFields(meta: Record<string, unknown>): string[] {
  const changed = meta.changed as string[] | undefined;
  if (changed && changed.length > 0) return changed;
  const after = meta.after as Record<string, unknown> | undefined;
  return after ? Object.keys(after) : [];
}

describe('AuditDiffViewer logic', () => {
  describe('formatValue', () => {
    it('formats null as dash', () => {
      expect(formatValue(null)).toBe('—');
    });

    it('formats undefined as dash', () => {
      expect(formatValue(undefined)).toBe('—');
    });

    it('formats boolean true as Sim', () => {
      expect(formatValue(true)).toBe('Sim');
    });

    it('formats boolean false as Não', () => {
      expect(formatValue(false)).toBe('Não');
    });

    it('formats string as-is', () => {
      expect(formatValue('hello')).toBe('hello');
    });

    it('formats number as string', () => {
      expect(formatValue(42)).toBe('42');
    });

    it('formats object as JSON', () => {
      expect(formatValue({ a: 1 })).toBe('{"a":1}');
    });
  });

  describe('classifyMetadata', () => {
    it('classifies create (only after)', () => {
      expect(classifyMetadata({ after: { nome: 'A' } })).toBe('create');
    });

    it('classifies delete (only before)', () => {
      expect(classifyMetadata({ before: { nome: 'A' } })).toBe('delete');
    });

    it('classifies update (before + after)', () => {
      expect(
        classifyMetadata({
          before: { nome: 'A' },
          after: { nome: 'B' },
          changed: ['nome'],
        }),
      ).toBe('update');
    });

    it('classifies raw (no before/after)', () => {
      expect(classifyMetadata({ target_user_id: '123' })).toBe('raw');
    });
  });

  describe('getDiffFields', () => {
    it('returns changed array when present', () => {
      const meta = {
        before: { nome: 'A', email: 'a@b.c' },
        after: { nome: 'B', email: 'a@b.c' },
        changed: ['nome'],
      };
      expect(getDiffFields(meta)).toEqual(['nome']);
    });

    it('falls back to after keys when no changed', () => {
      const meta = {
        before: { nome: 'A' },
        after: { nome: 'B', email: 'new@b.c' },
      };
      expect(getDiffFields(meta)).toEqual(['nome', 'email']);
    });

    it('returns empty array for delete (no after)', () => {
      const meta = { before: { nome: 'A' } };
      expect(getDiffFields(meta)).toEqual([]);
    });
  });
});
