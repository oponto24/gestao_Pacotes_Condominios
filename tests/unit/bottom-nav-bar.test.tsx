import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BottomNavBar } from '@/components/portaria/BottomNavBar';

const mockPathname = vi.fn(() => '/chegada');
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

describe('BottomNavBar', () => {
  beforeEach(() => mockPathname.mockReturnValue('/chegada'));

  it('renderiza 3 abas com labels visíveis (Chegada, Pendentes, Retirada)', () => {
    render(<BottomNavBar />);
    expect(screen.getByRole('link', { name: /Chegada/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pendentes/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Retirada/ })).toBeInTheDocument();
  });

  it('aba ativa (Chegada) recebe aria-current=page', () => {
    render(<BottomNavBar />);
    expect(screen.getByRole('link', { name: /Chegada/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Retirada/ })).not.toHaveAttribute('aria-current');
  });

  it('match de prefixo: /chegada/sub também ativa Chegada', () => {
    mockPathname.mockReturnValue('/chegada/captura');
    render(<BottomNavBar />);
    expect(screen.getByRole('link', { name: /Chegada/ })).toHaveAttribute('aria-current', 'page');
  });

  it('Pendentes ativa quando pathname é /portaria/pendentes', () => {
    mockPathname.mockReturnValue('/portaria/pendentes');
    render(<BottomNavBar />);
    expect(screen.getByRole('link', { name: /Pendentes/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Chegada/ })).not.toHaveAttribute('aria-current');
  });

  it('touch target adequado: side tabs ≥56px, FAB Chegada ≥64px (h-16)', () => {
    render(<BottomNavBar />);
    // FAB Chegada é botão primário central, alvo maior
    const chegada = screen.getByRole('link', { name: /Chegada/ });
    expect(chegada.className).toMatch(/h-16/);
    // Side tabs (Pendentes / Retirada) mantêm min-h-[56px]
    const pendentes = screen.getByRole('link', { name: /Pendentes/ });
    expect(pendentes.className).toContain('min-h-[56px]');
    const retirada = screen.getByRole('link', { name: /Retirada/ });
    expect(retirada.className).toContain('min-h-[56px]');
  });

  it('nav tem role + aria-label', () => {
    render(<BottomNavBar />);
    expect(screen.getByRole('navigation', { name: /portaria/i })).toBeInTheDocument();
  });
});
