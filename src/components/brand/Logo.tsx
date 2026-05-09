import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  /** Esconde a sublabel "Pacotes" — útil em headers muito apertados. */
  hideProductLabel?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<LogoProps['size']>, { wordmark: string; sublabel: string }> = {
  sm: { wordmark: 'text-base', sublabel: 'text-[10px]' },
  md: { wordmark: 'text-2xl', sublabel: 'text-xs' },
  lg: { wordmark: 'text-4xl sm:text-5xl', sublabel: 'text-sm' },
};

/**
 * Wordmark família de produto: PONTO24 (caps, peso 800) + sublabel "Pacotes".
 *
 * Alinha visualmente com a marca-mãe (https://ponto24-marketing.vercel.app/),
 * que usa o wordmark em caixa alta e Montserrat heavy. "Pacotes" indica que
 * este software é o produto de pacotes da família PONTO24 — análogo a
 * Google Drive / Google Calendar.
 */
export function Logo({ size = 'md', hideProductLabel = false, className }: LogoProps) {
  const sizes = SIZE_CLASSES[size];
  return (
    <span
      aria-label="PONTO24 Pacotes"
      className={cn('inline-flex flex-col leading-none', className)}
    >
      <span className={cn('font-extrabold tracking-tight', sizes.wordmark)}>
        <span className="text-brand-ink">PONTO</span>
        <span className="text-primary">24</span>
      </span>
      {!hideProductLabel ? (
        <span
          className={cn(
            'mt-0.5 font-semibold uppercase tracking-[0.2em] text-text-secondary',
            sizes.sublabel,
          )}
        >
          Pacotes
        </span>
      ) : null}
    </span>
  );
}
