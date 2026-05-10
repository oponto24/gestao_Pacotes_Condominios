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
  it('renderiza condominio nome + user nome + iniciais (via UserMenu)', () => {
    render(
      <PortariaLayout condominioNome="Ed. Aurora" userNome="João Silva">
        <p>Conteúdo</p>
      </PortariaLayout>,
    );
    expect(screen.getByText('Ed. Aurora')).toBeInTheDocument();
    expect(screen.getAllByText('João Silva').length).toBeGreaterThan(0); // header + UserMenu
    // UserMenu mostra iniciais "JS" no avatar
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

  it('iniciais "MA" quando nome único curto (UserMenu pega 2 letras)', () => {
    render(
      <PortariaLayout condominioNome="X" userNome="Maria">
        <p>x</p>
      </PortariaLayout>,
    );
    // UserMenu calcula initials("Maria") = "MA" (slice(0,2) do primeiro nome)
    expect(screen.getByText('MA')).toBeInTheDocument();
  });

  it('UserMenu expõe item Sair acessível via menuitem', () => {
    render(
      <PortariaLayout condominioNome="X" userNome="Y">
        <p>x</p>
      </PortariaLayout>,
    );
    // UserMenu renderiza Sair como menuitem (open via summary click)
    expect(screen.getByRole('menuitem', { name: /sair/i })).toBeInTheDocument();
  });
});
