import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl sm:text-5xl',
};

/**
 * Logo wordmark Ponto 24 (story 3.11).
 *
 * "Ponto" em cinza-tinta + "24" em amarelo brand.
 * TODO(brand): substituir por SVG oficial quando disponível.
 */
export function Logo({ size = 'md', className }: LogoProps) {
  return (
    <span
      aria-label="Ponto 24"
      className={cn(
        'inline-flex items-baseline gap-1 font-bold tracking-tight',
        SIZE_CLASSES[size],
        className,
      )}
    >
      <span className="text-brand-ink">Ponto</span>
      <span className="text-primary">24</span>
    </span>
  );
}
