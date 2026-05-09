import { notFound } from 'next/navigation';
import { requireAdminMaster } from '@/lib/api/admin-guard';
import { loadPacoteDetail } from '@/lib/db/pacote-admin-detail';
import { PacoteDetalheView } from '@/components/admin/PacoteDetalheView';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function PacoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAdminMaster();
  const pacote = await loadPacoteDetail(ctx, id);
  if (!pacote) notFound();
  return <PacoteDetalheView pacote={pacote} />;
}
