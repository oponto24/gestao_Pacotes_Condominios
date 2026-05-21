'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertCircle, Camera, Key, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBottomNav, type FabState } from './BottomNavContext';

/**
 * Bottom nav fixa da portaria (story 3.1 + Onda 1 polish).
 *
 * Layout: 2 abas laterais (Pendentes · Retirada) + FAB central elevado pra Chegada
 * (ação primária do porteiro). Touch ≥56px, FAB ≥64px (NFR-050).
 *
 * Mantém os mesmos 3 links — só muda o destaque visual da Chegada.
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: 'exact' | 'prefix';
}

const PENDENTES: NavItem = {
  href: '/portaria/pendentes',
  label: 'Pendentes',
  icon: <AlertCircle className="h-5 w-5" aria-hidden />,
  match: 'prefix',
};

const PALAVRAS_CHAVE: NavItem = {
  href: '/portaria/palavras-chave',
  label: 'Chaves',
  icon: <Key className="h-5 w-5" aria-hidden />,
  match: 'prefix',
};

const RETIRADA: NavItem = {
  href: '/retirada',
  label: 'Retirada',
  icon: <QrCode className="h-5 w-5" aria-hidden />,
  match: 'prefix',
};

const CHEGADA: NavItem = {
  href: '/chegada',
  label: 'Chegada',
  icon: <Camera className="h-7 w-7" aria-hidden />,
  match: 'prefix',
};

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match === 'exact') return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function BottomNavBar() {
  const pathname = usePathname() ?? '';
  const chegadaActive = isActive(pathname, CHEGADA);
  const pendentesActive = isActive(pathname, PENDENTES);
  const palavrasChaveActive = isActive(pathname, PALAVRAS_CHAVE);
  const retiradaActive = isActive(pathname, RETIRADA);
  const { override } = useBottomNav();

  // FAB central — quando override está setado por uma página (ex: CapturaPage
  // após captura de foto), vira botão de ação contextual em vez de link.
  //
  // Visual (PR-2 redesign): gradiente vertical OKLCH + glow shadow + hairline
  // interna branca pra sensação táctil. PR-3: state machine completa via
  // lookup `fabStateStyle[state]`. Tokens em globals.css.
  const fabBaseClass =
    'relative -top-5 flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-full ' +
    'transition-[background,box-shadow,transform] duration-300 ease-out ' +
    'shadow-[0_8px_24px_-4px_var(--fab-glow)] ' +
    'before:pointer-events-none before:absolute before:inset-0 before:rounded-full ' +
    "before:bg-[linear-gradient(180deg,oklch(1_0_0/0.25),oklch(1_0_0/0)_45%)] before:content-['']" +
    ' disabled:opacity-60';

  // Lookup state → estilo visual. Único ponto de verdade pro look do FAB.
  // - idle-route: gradiente padrão (link em outras rotas)
  // - idle-page: gradiente intenso + halo pulse (chamando ação primária)
  // - streaming: shutter branco (referência iOS de "tirar foto")
  // - captured: gradiente verde sucesso
  // - submitting: padrão disabled (parent renderiza spinner via icon)
  const fabStateStyle: Record<FabState, CSSProperties> = {
    'idle-route': {
      backgroundImage:
        'linear-gradient(180deg, var(--fab-default-from), var(--fab-default-to))',
    },
    'idle-page': {
      backgroundImage:
        'linear-gradient(180deg, var(--fab-action-from), var(--fab-action-to))',
      boxShadow: '0 10px 28px -4px var(--fab-glow)',
    },
    streaming: {
      backgroundColor: 'var(--fab-capture)',
      boxShadow:
        '0 8px 24px -4px oklch(0 0 0 / 0.25), inset 0 1px 0 oklch(1 0 0 / 0.5)',
    },
    captured: {
      backgroundImage:
        'linear-gradient(180deg, var(--fab-success-from), var(--fab-success-to))',
      boxShadow: '0 10px 28px -4px var(--fab-glow-success)',
    },
    submitting: {
      backgroundImage:
        'linear-gradient(180deg, var(--fab-default-from), var(--fab-default-to))',
    },
  };

  // Estados com texto branco (default). Streaming usa foreground pq fundo é branco.
  const fabStateTextClass: Record<FabState, string> = {
    'idle-route': 'text-white',
    'idle-page': 'text-white',
    streaming: 'text-foreground',
    captured: 'text-white',
    submitting: 'text-white',
  };

  return (
    <nav
      role="navigation"
      aria-label="Navegação portaria"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background"
    >
      <div className="relative mx-auto flex max-w-screen-md items-end justify-around">
        <SideTab item={PENDENTES} active={pendentesActive} />
        <SideTab item={PALAVRAS_CHAVE} active={palavrasChaveActive} />

        {override ? (
          <button
            type="button"
            onClick={override.onClick}
            disabled={override.disabled}
            aria-label={override.ariaLabel ?? override.label}
            aria-busy={override.disabled || undefined}
            className={cn(
              fabBaseClass,
              fabStateTextClass[override.state],
              // Halo pulse só em idle-page (chamando ação) e captured (sucesso fresco).
              // Apple HIG: pulse em estado iminente OK, pulse em neutro cansa.
              override.state === 'idle-page' && 'animate-fab-halo',
              // Streaming: ring branco externo simula shutter da câmera iOS.
              override.state === 'streaming' &&
                'outline outline-4 outline-offset-2 outline-white/55',
            )}
            style={fabStateStyle[override.state]}
          >
            <span className="relative z-[1] flex flex-col items-center gap-0.5">
              {override.icon}
              {override.label && (
                <span className="text-[11px] font-semibold tracking-wide">
                  {override.label}
                </span>
              )}
            </span>
          </button>
        ) : (
          // Sem override: link pra /chegada. Caso típico = idle-route (outra rota).
          // Quando em /chegada sem override (race condition no mount do CapturaPageClient),
          // mostra estado idle-page como hint visual.
          <Link
            href={CHEGADA.href}
            aria-current={chegadaActive ? 'page' : undefined}
            aria-label={CHEGADA.label}
            className={cn(fabBaseClass, 'text-white')}
            style={chegadaActive ? fabStateStyle['idle-page'] : fabStateStyle['idle-route']}
          >
            <span className="relative z-[1] flex flex-col items-center gap-0.5">
              {CHEGADA.icon}
              <span className="text-[11px] font-semibold tracking-wide">
                {CHEGADA.label}
              </span>
            </span>
          </Link>
        )}

        <SideTab item={RETIRADA} active={retiradaActive} />
      </div>
    </nav>
  );
}

function SideTab({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-4 py-2 text-xs font-medium transition-colors',
        active ? 'text-primary' : 'text-text-secondary hover:text-foreground',
      )}
    >
      <span className={cn(active && 'scale-110 transition-transform')}>{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}
