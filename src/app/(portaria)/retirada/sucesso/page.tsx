import Link from 'next/link';
import { CheckCircle2, Package, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function RetiradaSucessoPage({
  searchParams,
}: {
  searchParams: Promise<{ destinatario?: string }>;
}) {
  const { destinatario } = await searchParams;
  return (
    <div className="flex flex-col items-center gap-4 pt-8 pb-8 text-center">
      <div className="rounded-full bg-success/10 p-6 text-success">
        <CheckCircle2 className="size-16" aria-hidden />
      </div>
      <h1 className="text-2xl font-semibold text-foreground">Entregue com sucesso!</h1>
      {destinatario && (
        <p className="text-sm text-text-secondary">
          Pacote de <strong>{destinatario}</strong> registrado como retirado.
        </p>
      )}
      <div className="mt-4 flex w-full max-w-sm flex-col gap-2">
        <Link href="/retirada">
          <Button className="h-12 w-full text-base">
            <QrCode className="mr-2 size-4" aria-hidden />
            Próxima retirada
          </Button>
        </Link>
        <Link href="/chegada">
          <Button variant="ghost" className="w-full">
            <Package className="mr-2 size-4" aria-hidden />
            Voltar para chegada
          </Button>
        </Link>
      </div>
    </div>
  );
}
