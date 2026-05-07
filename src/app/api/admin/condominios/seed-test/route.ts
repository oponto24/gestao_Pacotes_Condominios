import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requireSuperAdmin } from '@/lib/api/super-admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ForbiddenError } from '@/server/errors';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FIXTURE_NOME = 'Edifício Demo';

/**
 * Smoke endpoint DEV ONLY: cria/garante 1 condomínio fixture.
 * Idempotente — útil pra teste manual rápido sem preencher form.
 */
export async function POST(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'admin/condominios:seed-test' });
  try {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenError('Endpoint dev-only');
    }
    await requireSuperAdmin();

    const existing = await db.condominio.findFirst({ where: { nome: FIXTURE_NOME } });
    if (existing) {
      return NextResponse.json({ ok: true, condominio_id: existing.id, action: 'existing' });
    }

    const created = await db.condominio.create({
      data: {
        nome: FIXTURE_NOME,
        cnpj: '00000000000191',
        endereco: 'Rua Demo, 100',
        cep: '01000000',
        cidade: 'São Paulo',
        estado: 'SP',
        contato_nome: 'Síndico Demo',
        contato_telefone: '+5511999990000',
        contato_email: 'demo@example.com',
        ativo: true,
      },
    });
    log.info({ condominio_id: created.id }, 'fixture criado');
    return NextResponse.json({ ok: true, condominio_id: created.id, action: 'created' });
  } catch (err) {
    return handleApiError(err, log);
  }
}
