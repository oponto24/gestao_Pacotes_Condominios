import { redirect, notFound } from 'next/navigation';
import { requirePorteiro } from '@/lib/api/portaria-guard';
import { loadPacoteByQrToken } from '@/lib/db/pacote-retirada';
import { isValidQrToken } from '@/lib/retirada/extract-qr-token';
import { RetiradaConfirmarClient } from '@/components/portaria/RetiradaConfirmarClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function RetiradaConfirmarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isValidQrToken(token)) {
    redirect('/retirada?erro=token_invalido');
  }

  const ctx = await requirePorteiro();
  const result = await loadPacoteByQrToken(ctx, token);

  if (!result.ok) {
    if (result.reason === 'not_found') notFound();
    redirect(`/retirada?erro=${result.reason}`);
  }

  return (
    <RetiradaConfirmarClient
      pacote={result.pacote}
      outrosPacotes={result.outrosPacotes}
    />
  );
}
