import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@/components/ui/empty-state';

describe('EmptyState', () => {
  it('renderiza title', () => {
    render(<EmptyState title="Sem dados" />);
    expect(screen.getByRole('heading', { name: 'Sem dados' })).toBeInTheDocument();
  });

  it('renderiza description quando passada', () => {
    render(<EmptyState title="Vazio" description="Tente outra busca" />);
    expect(screen.getByText('Tente outra busca')).toBeInTheDocument();
  });

  it('renderiza action quando passada', () => {
    render(<EmptyState title="Vazio" action={<button>Criar</button>} />);
    expect(screen.getByRole('button', { name: 'Criar' })).toBeInTheDocument();
  });
});
