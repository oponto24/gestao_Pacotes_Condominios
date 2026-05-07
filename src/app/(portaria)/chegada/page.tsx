import { ChegadaPlaygroundClient } from '@/components/portaria/ChegadaPlaygroundClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Playground temporário (story 3.2) — exercita o `<PhotoCapture>` em browser real.
 * Será substituído pela tela de chegada completa na story 3.6 (formulário de captura).
 */
export default function ChegadaPage() {
  return <ChegadaPlaygroundClient />;
}
