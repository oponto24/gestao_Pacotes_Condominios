/* @vitest-environment node */
/**
 * Testes de integração — Reconciliação Clerk via lógica de DB direta
 *
 * Cobre:
 *   - Story 8.5 AC4: super-admin cria user admin pendente →
 *     webhook user.created com mesmo email reconcilia (clerk_id placeholder → real)
 *   - Story 8.7 AC4: admin cadastra porteiro pendente →
 *     webhook user.created com mesmo email reconcilia
 *   - Story 8.7 AC6-S1: após reconciliação, user porteiro fica ativo com role e
 *     condominio_id preservados (pronto para login)
 *   - Cenário negativo: webhook com email sem user pré-provisionado NÃO cria registro
 *
 * Estratégia: testa a lógica de reconciliação DIRETAMENTE via Prisma,
 * sem HTTP, sem Svix, sem app rodando — o mesmo bloco lógico do webhook handler
 * (busca por email + update clerk_id) é reproduzido aqui como função pura.
 * Isso isola o comportamento de DB de infraestrutura de rede.
 *
 * Guard: pula automaticamente se DATABASE_URL não aponta para Postgres real.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const RUNTIME_URL = process.env.DATABASE_RUNTIME_URL ?? process.env.DATABASE_URL;

/**
 * Replica exatamente o bloco de reconciliação do webhook handler
 * (src/app/api/webhooks/clerk/route.ts linhas 84-117), sem a camada HTTP/Svix.
 * Retorna 'clerk_id' | 'email' | 'new' | 'self_signup_blocked'
 */
async function reconcileClerkUser(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  clerkId: string,
  email: string,
  nome: string,
): Promise<'clerk_id' | 'email' | 'new' | 'self_signup_blocked'> {
  const byClerkId = await tx.user.findUnique({ where: { clerk_id: clerkId } });

  if (byClerkId) {
    await tx.user.update({
      where: { clerk_id: clerkId },
      data: { email, nome, ativo: true },
    });
    return 'clerk_id';
  }

  const byEmail = await tx.user.findUnique({ where: { email } });
  if (byEmail) {
    await tx.user.update({
      where: { email },
      data: { clerk_id: clerkId, nome, ativo: true },
    });
    return 'email';
  }

  // Decisão produto 2026-05-07: self-signup desabilitado durante MVP
  return 'self_signup_blocked';
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const DB_REACHABLE =
  !!RUNTIME_URL && RUNTIME_URL.includes('postgresql://') && !RUNTIME_URL.includes('fake');

const db = new PrismaClient({ datasources: { db: { url: RUNTIME_URL } } });

const TEST_TAG = `reconcile-test-${Date.now()}`;

// IDs de condomínio fixture (criados no beforeAll)
let condId = '';

// Registra clerk_ids criados para cleanup garantido no afterAll
const createdClerkIds: string[] = [];

beforeAll(async () => {
  if (!DB_REACHABLE) return;

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;

    const cond = await tx.condominio.create({
      data: {
        nome: `${TEST_TAG}-Cond`,
        endereco: 'Rua Teste, 1',
        cep: '01001-000',
        cidade: 'São Paulo',
        estado: 'SP',
        contato_nome: 'Contato Teste',
        contato_telefone: '11999990000',
      },
      select: { id: true },
    });
    condId = cond.id;
  });
});

afterAll(async () => {
  if (!DB_REACHABLE) {
    await db.$disconnect();
    return;
  }

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;

    // Remove users criados nos testes (pelos clerk_ids registrados)
    if (createdClerkIds.length > 0) {
      await tx.user.deleteMany({
        where: { clerk_id: { in: createdClerkIds } },
      });
      // Remove também qualquer user que ainda ficou com clerk_id pendente do TEST_TAG
      await tx.user.deleteMany({
        where: { clerk_id: { startsWith: `pending_clerk_link_${TEST_TAG}` } },
      });
    }

    if (condId) {
      await tx.condominio.delete({ where: { id: condId } });
    }
  });

  await db.$disconnect();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pendingClerkId(suffix: string): string {
  return `pending_clerk_link_${TEST_TAG}_${suffix}`;
}

function realClerkId(suffix: string): string {
  return `user_real_${TEST_TAG}_${suffix}`;
}

async function insertPendingUser(opts: {
  clerkId: string;
  email: string;
  nome: string;
  role: 'admin_master' | 'admin_funcionario' | 'porteiro';
  condominioId: string | null;
}) {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    await tx.user.create({
      data: {
        clerk_id: opts.clerkId,
        email: opts.email,
        nome: opts.nome,
        role: opts.role,
        condominio_id: opts.condominioId,
        ativo: true,
      },
    });
  });
}

async function fetchUser(clerkId: string) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    return tx.user.findUnique({ where: { clerk_id: clerkId } });
  });
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe.skipIf(!DB_REACHABLE)('Clerk webhook reconciliation — lógica de DB direta', () => {
  /**
   * Story 8.5 AC4
   * Super-admin criou user admin com clerk_id placeholder. Quando a pessoa cria
   * conta no Clerk com o mesmo email, o webhook deve substituir o placeholder
   * pelo clerk_id real e preservar role + condominio_id.
   */
  it('reconcilia user admin pendente quando Clerk user.created chega com mesmo email', async () => {
    const placeholder = pendingClerkId('admin');
    const realId = realClerkId('admin');
    const email = `admin-${TEST_TAG}@test.local`;

    createdClerkIds.push(realId);

    // Simula provisionamento pelo super-admin (story 8.5 — cria com clerk_id placeholder)
    await insertPendingUser({
      clerkId: placeholder,
      email,
      nome: 'Admin Pre-Cadastrado',
      role: 'admin_master',
      condominioId: condId,
    });

    // Confirma estado inicial: clerk_id é placeholder
    const before = await fetchUser(placeholder);
    expect(before).toBeTruthy();
    expect(before?.clerk_id).toBe(placeholder);
    expect(before?.role).toBe('admin_master');
    expect(before?.condominio_id).toBe(condId);

    // Simula execução da lógica de reconciliação do webhook handler
    const result = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return reconcileClerkUser(tx, realId, email, 'Admin Reconciliado');
    });

    expect(result).toBe('email'); // reconciliou por email (não por clerk_id)

    // Após reconciliação: clerk_id real no lugar do placeholder
    const after = await fetchUser(realId);
    expect(after).toBeTruthy();
    expect(after?.clerk_id).toBe(realId);
    expect(after?.email).toBe(email);
    expect(after?.nome).toBe('Admin Reconciliado');
    expect(after?.role).toBe('admin_master');       // role preservada
    expect(after?.condominio_id).toBe(condId);      // condomínio preservado
    expect(after?.ativo).toBe(true);

    // Placeholder não deve mais existir
    const ghost = await fetchUser(placeholder);
    expect(ghost).toBeNull();
  });

  /**
   * Story 8.7 AC4 + AC6-S1
   * Admin cadastrou porteiro com email X. Quando porteiro cria conta Clerk com
   * email X em outro browser/sessão, a reconciliação deve funcionar e o user
   * deve ficar pronto para login como porteiro do condomínio.
   */
  it('reconcilia user porteiro pendente quando Clerk user.created chega com mesmo email', async () => {
    const placeholder = pendingClerkId('porteiro');
    const realId = realClerkId('porteiro');
    const email = `porteiro-${TEST_TAG}@test.local`;

    createdClerkIds.push(realId);

    // Simula provisionamento pelo admin (story 8.7 — porteiro pré-cadastrado)
    await insertPendingUser({
      clerkId: placeholder,
      email,
      nome: 'Porteiro Pre-Cadastrado',
      role: 'porteiro',
      condominioId: condId,
    });

    // Confirma estado inicial
    const before = await fetchUser(placeholder);
    expect(before?.clerk_id).toBe(placeholder);
    expect(before?.role).toBe('porteiro');

    // Simula lógica de reconciliação do webhook
    const result = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return reconcileClerkUser(tx, realId, email, 'Porteiro Reconciliado');
    });

    expect(result).toBe('email');

    // Story 8.7 AC6-S1: após reconciliação, porteiro deve ter clerk_id real,
    // role=porteiro e condominio_id correto — pronto para login no /chegada
    const after = await fetchUser(realId);
    expect(after).toBeTruthy();
    expect(after?.clerk_id).toBe(realId);
    expect(after?.email).toBe(email);
    expect(after?.role).toBe('porteiro');           // role porteiro preservada
    expect(after?.condominio_id).toBe(condId);      // condomínio preservado — crítico para /chegada
    expect(after?.ativo).toBe(true);               // ativo para login

    // Confirma que placeholder sumiu
    const ghost = await fetchUser(placeholder);
    expect(ghost).toBeNull();
  });

  /**
   * Cenário negativo: email sem user pré-provisionado → self-signup bloqueado.
   * Nenhum registro novo é criado no banco.
   */
  it('ignora webhook quando email não tem user pendente (self-signup desabilitado)', async () => {
    const orphanClerkId = realClerkId('orphan');
    const orphanEmail = `orphan-${TEST_TAG}@test.local`;

    // Confirma que não existe registro pré-provisionado para este email
    const existing = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return tx.user.findUnique({ where: { email: orphanEmail } });
    });
    expect(existing).toBeNull();

    // Simula lógica de reconciliação do webhook
    const result = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return reconcileClerkUser(tx, orphanClerkId, orphanEmail, 'Forasteiro');
    });

    expect(result).toBe('self_signup_blocked');

    // Nenhum registro criado — conta Clerk fica órfã sem acesso ao sistema
    const after = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return tx.user.findUnique({ where: { clerk_id: orphanClerkId } });
    });
    expect(after).toBeNull();
  });

  /**
   * Bônus: webhook user.created para clerk_id que já existe no banco
   * (user criado com Clerk funcionando, sem fallback) — atualiza dados, não duplica.
   */
  it('atualiza dados quando clerk_id já existe (sem placeholder)', async () => {
    const existingClerkId = realClerkId('existing');
    const email = `existing-${TEST_TAG}@test.local`;

    createdClerkIds.push(existingClerkId);

    // Simula user criado com Clerk real desde o início (sem fallback pending)
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      await tx.user.create({
        data: {
          clerk_id: existingClerkId,
          email,
          nome: 'Admin Nome Antigo',
          role: 'admin_funcionario',
          condominio_id: condId,
          ativo: true,
        },
      });
    });

    // Webhook user.updated (ou user.created duplicado) com nome atualizado
    const result = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return reconcileClerkUser(tx, existingClerkId, email, 'Admin Nome Novo');
    });

    expect(result).toBe('clerk_id'); // achou por clerk_id, não por email

    const after = await fetchUser(existingClerkId);
    expect(after?.nome).toBe('Admin Nome Novo');  // nome atualizado
    expect(after?.role).toBe('admin_funcionario'); // role preservada
    expect(after?.condominio_id).toBe(condId);    // condomínio preservado
    expect(after?.ativo).toBe(true);
  });
});
