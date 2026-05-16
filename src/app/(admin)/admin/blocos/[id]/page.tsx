import { notFound } from 'next/navigation';
import { getBlocoById } from '@/lib/db/bloco';
import { BlocoDetailClient } from '@/components/admin/BlocoDetailClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BlocoDetailPage({ params }: Props) {
  const { id } = await params;
  const bloco = await getBlocoById(id);

  if (!bloco) {
    notFound();
  }

  return <BlocoDetailClient bloco={bloco} />;
}
