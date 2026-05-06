import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Clique aqui</Button>);
    expect(screen.getByRole('button', { name: 'Clique aqui' })).toBeInTheDocument();
  });

  it('applies primary variant by default', () => {
    render(<Button>Default</Button>);
    const button = screen.getByRole('button', { name: 'Default' });
    expect(button.className).toContain('bg-primary');
  });

  it('applies danger variant when specified', () => {
    render(<Button variant="danger">Excluir</Button>);
    const button = screen.getByRole('button', { name: 'Excluir' });
    expect(button.className).toContain('bg-danger');
  });
});
