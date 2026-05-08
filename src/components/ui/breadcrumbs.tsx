'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

const LABELS: Record<string, string> = {
  admin: 'Admin',
  'super-admin': 'Super-admin',
  pacotes: 'Pacotes',
  moradores: 'Moradores',
  unidades: 'Unidades',
  setores: 'Setores',
  cadastros: 'Cadastros',
  importar: 'Importar CSV',
  preview: 'Pré-visualização',
  equipe: 'Equipe',
  funcionarios: 'Funcionários',
  condominios: 'Condomínios',
  users: 'Usuários',
  audit: 'Audit log',
};

function labelFor(segment: string): string {
  if (LABELS[segment]) return LABELS[segment];
  // UUIDs/IDs ficam genéricos
  if (/^[0-9a-f-]{20,}$/i.test(segment)) return 'Detalhe';
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

interface Props {
  homeHref?: string;
  homeLabel?: string;
}

export function Breadcrumbs({ homeHref = '/admin', homeLabel = 'Início' }: Props) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  // Esconde se estiver na própria home
  if (segments.length <= 1) return null;

  // Remove o segmento "raiz" (admin/super-admin) — é o homeHref
  const trail = segments.slice(1);

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-text-secondary">
      <Link href={homeHref} className="hover:text-foreground">
        {homeLabel}
      </Link>
      {trail.map((seg, idx) => {
        const href = '/' + segments.slice(0, idx + 2).join('/');
        const isLast = idx === trail.length - 1;
        return (
          <span key={href} className="flex items-center gap-1">
            <ChevronRight className="size-3" aria-hidden />
            {isLast ? (
              <span className="font-medium text-foreground">{labelFor(seg)}</span>
            ) : (
              <Link href={href} className="hover:text-foreground">
                {labelFor(seg)}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
