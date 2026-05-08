'use client';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="pt-BR">
      <body className="bg-background">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-2xl font-bold text-foreground">Erro fatal</h1>
          <p className="max-w-md text-text-secondary">
            Algo crítico falhou. Recarregue a página ou tente novamente em alguns minutos.
          </p>
          {error.digest && (
            <p className="text-xs text-text-secondary/70">ref: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
