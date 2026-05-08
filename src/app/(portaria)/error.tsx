'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PortariaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertCircle className="size-10 text-danger" aria-hidden />
      <div>
        <h2 className="text-xl font-semibold text-foreground">Algo deu errado</h2>
        <p className="mt-1 text-sm text-text-secondary">
          {error.message || 'Não foi possível carregar agora.'}
        </p>
      </div>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
