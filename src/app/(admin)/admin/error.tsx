'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <AlertCircle className="size-10 text-danger" aria-hidden />
      <div>
        <h2 className="text-xl font-semibold text-foreground">Algo deu errado</h2>
        <p className="mt-1 text-sm text-text-secondary">
          {error.message || 'Erro inesperado ao carregar esta tela.'}
          {error.digest && (
            <span className="mt-1 block text-xs text-text-secondary/70">ref: {error.digest}</span>
          )}
        </p>
      </div>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
