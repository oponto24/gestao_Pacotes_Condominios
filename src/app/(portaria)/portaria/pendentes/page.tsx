import { CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function PendentesPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold text-foreground">Pendentes</h1>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-background p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-text-secondary" aria-hidden />
        <p className="text-sm text-text-secondary">
          Sem pendências por enquanto. Pacotes que não conseguirem ser identificados
          automaticamente aparecerão aqui (story 3.10).
        </p>
      </div>
    </div>
  );
}
