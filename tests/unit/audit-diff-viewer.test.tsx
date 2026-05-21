/* @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuditDiffViewer } from '@/components/super-admin/AuditDiffViewer';

describe('AuditDiffViewer', () => {
  it('redacts sensitive fields in update diffs', () => {
    const metadata = {
      before: { nome: 'João', telefone: '11999999999', email: 'joao@test.com', clerk_id: 'pending_clerk_link_abc' },
      after: { nome: 'João Silva', telefone: '11888888888', email: 'joao2@test.com', clerk_id: 'user_abc123' },
      changed: ['nome', 'telefone', 'email', 'clerk_id'],
    };

    render(<AuditDiffViewer metadata={metadata} />);

    // nome should NOT be redacted
    expect(screen.getByText('João')).toBeDefined();
    expect(screen.getByText('João Silva')).toBeDefined();

    // sensitive fields should be redacted
    const redacted = screen.getAllByText('[redacted]');
    // telefone before + after + email before + after + clerk_id before + after = 6
    expect(redacted.length).toBe(6);

    // raw values should NOT appear
    expect(screen.queryByText('11999999999')).toBeNull();
    expect(screen.queryByText('joao@test.com')).toBeNull();
    expect(screen.queryByText('pending_clerk_link_abc')).toBeNull();
  });

  it('redacts sensitive fields in create snapshots', () => {
    const metadata = {
      after: { nome: 'Maria', email: 'maria@test.com', contato_telefone: '21999999999' },
    };

    render(<AuditDiffViewer metadata={metadata} />);

    expect(screen.getByText('Maria')).toBeDefined();
    const redacted = screen.getAllByText('[redacted]');
    expect(redacted.length).toBe(2); // email + contato_telefone
  });
});
