import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6 text-center">
      <Logo size="md" />
      <div>
        <h1 className="text-3xl font-bold text-foreground">Página não encontrada</h1>
        <p className="mt-2 text-text-secondary">
          O endereço que você acessou não existe ou foi movido.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary-dark"
      >
        Voltar pro início
      </Link>
    </div>
  );
}
