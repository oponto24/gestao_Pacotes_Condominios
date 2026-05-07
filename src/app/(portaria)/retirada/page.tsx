import { QrCode } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function RetiradaPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold text-foreground">Retirada</h1>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-background p-8 text-center">
        <QrCode className="h-12 w-12 text-text-secondary" aria-hidden />
        <p className="text-sm text-text-secondary">
          Em breve: scan do QR Code do morador para registrar entrega (story 5.1).
        </p>
      </div>
    </div>
  );
}
