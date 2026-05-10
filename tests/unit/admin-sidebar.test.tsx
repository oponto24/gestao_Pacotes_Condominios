import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

// Mock next/navigation usePathname
const mockPathname = vi.fn(() => '/admin');
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

// Mock SignOutButton (Clerk) — apenas renderiza children
vi.mock('@clerk/nextjs', () => ({
  SignOutButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('AdminSidebar', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/admin');
    try {
      window.localStorage?.removeItem('aiox.adminSidebar.cadastrosOpen');
    } catch {
      // localStorage indisponível em alguns ambientes — OK
    }
  });

  it('renderiza items principais (Pacotes, Cadastros expandido)', () => {
    render(<AdminSidebar />);
    expect(screen.getByRole('link', { name: /Pacotes/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cadastros/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Setores/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Unidades/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Moradores/ })).toBeInTheDocument();
    // Logout consolidado no UserMenu do AdminHeader (achado U2)
    expect(screen.queryByRole('button', { name: /Sair/ })).not.toBeInTheDocument();
  });

  it('item ativo recebe aria-current=page', () => {
    mockPathname.mockReturnValue('/admin/setores');
    render(<AdminSidebar />);
    expect(screen.getByRole('link', { name: /Setores/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Pacotes/ })).not.toHaveAttribute('aria-current');
  });

  it('toggle de Cadastros esconde sub-items', () => {
    render(<AdminSidebar />);
    const toggle = screen.getByRole('button', { name: /Cadastros/ });
    expect(screen.getByRole('link', { name: /Setores/ })).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.queryByRole('link', { name: /Setores/ })).not.toBeInTheDocument();
  });
});
