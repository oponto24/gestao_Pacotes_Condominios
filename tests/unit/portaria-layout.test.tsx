import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PortariaLayout } from '@/components/portaria/PortariaLayout';

vi.mock('next/navigation', () => ({
  usePathname: () => '/chegada',
}));

vi.mock('@clerk/nextjs', () => ({
  SignOutButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('PortariaLayout', () => {
  it('renderiza condominio nome + user nome + iniciais', () => {
    render(
      <PortariaLayout condominioNome="Ed. Aurora" userNome="João Silva">
        <p>Conteúdo</p>
      </PortariaLayout>,
    );
    expect(screen.getByText('Ed. Aurora')).toBeInTheDocument();
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    // Iniciais "JS"
    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('renderiza children no main', () => {
    render(
      <PortariaLayout condominioNome="X" userNome="Y">
        <p data-testid="conteudo">Conteúdo da rota</p>
      </PortariaLayout>,
    );
    expect(screen.getByTestId('conteudo')).toHaveTextContent('Conteúdo da rota');
  });

  it('inclui BottomNavBar (3 abas)', () => {
    render(
      <PortariaLayout condominioNome="X" userNome="Y">
        <p>x</p>
      </PortariaLayout>,
    );
    expect(screen.getByRole('navigation', { name: /portaria/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Chegada/ })).toBeInTheDocument();
  });

  it('iniciais padrão "P" quando nome único curto', () => {
    render(
      <PortariaLayout condominioNome="X" userNome="Maria">
        <p>x</p>
      </PortariaLayout>,
    );
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('botão Sair com aria-label', () => {
    render(
      <PortariaLayout condominioNome="X" userNome="Y">
        <p>x</p>
      </PortariaLayout>,
    );
    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
  });
});
