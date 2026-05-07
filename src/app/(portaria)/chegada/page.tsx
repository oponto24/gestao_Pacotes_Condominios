import { Package } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function ChegadaPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold text-foreground">Nova chegada</h1>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-background p-8 text-center">
        <Package className="h-12 w-12 text-text-secondary" aria-hidden />
        <p className="text-sm text-text-secondary">
          Em breve: captura de foto + bipe de código de barras (stories 3.2 e 3.3).
        </p>
      </div>
    </div>
  );
}
