'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Package, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SucessoData {
  destinatario?: string;
  qtd?: number;
}

export default function RetiradaSucessoPage() {
  const [data, setData] = useState<SucessoData>({});

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('retirada_sucesso');
      if (raw) {
        setData(JSON.parse(raw) as SucessoData);
        sessionStorage.removeItem('retirada_sucesso');
      }
    } catch { /* ignore parse errors */ }
  }, []);

  const quantidade = data.qtd ?? 1;
  const plural = quantidade > 1;

  return (
    <div className="flex flex-col items-center gap-4 pt-8 pb-8 text-center">
      <div className="rounded-full bg-success/10 p-6 text-success">
        <CheckCircle2 className="size-16" aria-hidden />
      </div>
      <h1 className="text-2xl font-semibold text-foreground">
        {plural ? `${quantidade} pacotes entregues!` : 'Entregue com sucesso!'}
      </h1>
      {data.destinatario && (
        <p className="text-sm text-text-secondary">
          {plural ? `${quantidade} pacotes` : 'Pacote'} de <strong>{data.destinatario}</strong>{' '}
          {plural ? 'registrados como retirados' : 'registrado como retirado'}.
        </p>
      )}
      {!data.destinatario && (
        <p className="text-sm text-text-secondary">Entrega confirmada.</p>
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
