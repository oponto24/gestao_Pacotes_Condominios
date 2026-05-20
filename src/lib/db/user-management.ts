/**
 * Gestão de users via UI (stories 8.5/8.6/8.7).
 *
 * Fluxo de cadastro:
 *   1. Gera senha temporária aleatória
 *   2. Cria user no Clerk com email + senha temporária
 *   3. Cria User no banco com clerk_id real
 *   4. Retorna senha temporária pro admin compartilhar (email + senha)
 *   5. Pessoa faz login normal e pode mudar a senha depois
 */

import { randomBytes } from 'node:crypto';
import { createClerkClient } from '@clerk/nextjs/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { ValidationError } from '@/server/errors';

export const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

export type CreatableRole = 'admin_master' | 'admin_funcionario' | 'porteiro';

export interface CreatePendingUserInput {
  email: string;
  nome: string;
  role: CreatableRole;
  condominioId: string;
}

export interface PendingUser {
  id: string;
  email: string;
  nome: string;
  role: string;
  condominio_id: string | null;
  clerk_id: string;
  ativo: boolean;
  created_at: Date;
  ultimo_login: Date | null;
}

function genPendingClerkId(): string {
  return `pending_clerk_link_${randomBytes(12).toString('hex')}`;
}

function genTempPassword(): string {
  // 4 chars aleatórios + 4 dígitos = fácil de compartilhar por WhatsApp
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  let pwd = '';
  for (let i = 0; i < 4; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  for (let i = 0; i < 4; i++) pwd += digits[Math.floor(Math.random() * digits.length)];
  return pwd;
}

export interface CreateUserResult {
  user: PendingUser;
  tempPassword: string | null;
}

export async function createPendingUser(
  input: CreatePendingUserInput,
): Promise<CreateUserResult> {
  const email = input.email.toLowerCase().trim();
  const nome = input.nome.trim();

  // Valida email único
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    throw new ValidationError('Já existe um usuário com este e-mail');
  }

  // Valida cond ativo (segurança extra; APIs já validam antes)
  const cond = await db.condominio.findFirst({
    where: { id: input.condominioId, ativo: true, deleted_at: null },
    select: { id: true },
  });
  if (!cond) {
    throw new ValidationError('Condomínio inválido ou inativo');
  }

  // Cria user no Clerk com senha temporária
  let clerkId: string;
  let tempPassword: string | null = null;
  try {
    const [firstName, ...rest] = nome.split(' ');
    tempPassword = genTempPassword();
    const clerkUser = await clerk.users.createUser({
      emailAddress: [email],
      firstName,
      lastName: rest.join(' ') || undefined,
      password: tempPassword,
    });
    clerkId = clerkUser.id;
  } catch (clerkErr: unknown) {
    const clerkErrors =
      clerkErr && typeof clerkErr === 'object' && 'errors' in clerkErr
        ? (clerkErr as { errors: Array<{ code: string }> }).errors
        : [];
    const isDuplicate = clerkErrors.some(
      (e) => e.code === 'form_identifier_exists',
    );
    if (isDuplicate) {
      throw new ValidationError('Já existe uma conta com este e-mail');
    }
    // Fallback: cria com pending (reconcilia por webhook)
    console.error('[user-management] Clerk createUser falhou, usando fallback:', clerkErr instanceof Error ? clerkErr.message : clerkErr);
    clerkId = genPendingClerkId();
    tempPassword = null;
  }

  try {
    const created = await db.user.create({
      data: {
        clerk_id: clerkId,
        email,
        nome,
        role: input.role,
        condominio_id: input.condominioId,
        ativo: true,
      },
    });
    return { user: created as PendingUser, tempPassword };
  } catch (err) {
    // Se o DB falhou mas o Clerk user foi criado, limpa o Clerk
    if (!clerkId.startsWith('pending_clerk_link_')) {
      clerk.users.deleteUser(clerkId).catch(() => {});
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new ValidationError('Já existe um usuário com este e-mail');
    }
    throw err;
  }
}

export async function listAdminsByCondominio(condominioId: string): Promise<PendingUser[]> {
  return db.user.findMany({
    where: { condominio_id: condominioId, role: { in: ['admin_master', 'admin_funcionario'] } },
    orderBy: { created_at: 'desc' },
  }) as Promise<PendingUser[]>;
}

export async function listPorteirosByCondominio(condominioId: string): Promise<PendingUser[]> {
  return db.user.findMany({
    where: { condominio_id: condominioId, role: 'porteiro' },
    orderBy: { created_at: 'desc' },
  }) as Promise<PendingUser[]>;
}

export async function listAllAdmins(): Promise<
  Array<PendingUser & { condominio_nome: string | null }>
> {
  const admins = (await db.user.findMany({
    where: { role: { in: ['admin_master', 'admin_funcionario'] } },
    orderBy: [{ condominio_id: 'asc' }, { created_at: 'desc' }],
  })) as PendingUser[];
  const condIds = [...new Set(admins.map((a) => a.condominio_id).filter(Boolean) as string[])];
  const conds = condIds.length
    ? await db.condominio.findMany({
        where: { id: { in: condIds } },
        select: { id: true, nome: true },
      })
    : [];
  const map = new Map(conds.map((c) => [c.id, c.nome]));
  return admins.map((a) => ({
    ...a,
    condominio_nome: a.condominio_id ? map.get(a.condominio_id) ?? null : null,
  }));
}

/** True se clerk_id ainda é placeholder (user nunca logou). */
export function isPending(clerk_id: string): boolean {
  return clerk_id.startsWith('pending_clerk_link_');
}

// --- Story 12.3: CRUD usuarios cross-tenant (super-admin) ---

export interface ListAllUsersParams {
  page: number;
  pageSize: number;
  role?: CreatableRole;
  condominioId?: string;
  status?: 'ativo' | 'pendente' | 'inativo';
  q?: string;
}

export async function listAllUsers(params: ListAllUsersParams) {
  const where: Prisma.UserWhereInput = {
    role: { not: 'super_admin' },
    ...(params.role ? { role: params.role } : {}),
    ...(params.condominioId ? { condominio_id: params.condominioId } : {}),
    ...(params.q
      ? {
          OR: [
            { nome: { contains: params.q, mode: 'insensitive' } },
            { email: { contains: params.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  // Status filter
  if (params.status === 'ativo') {
    where.ativo = true;
    where.clerk_id = { not: { startsWith: 'pending_clerk_link_' } };
  } else if (params.status === 'pendente') {
    where.clerk_id = { startsWith: 'pending_clerk_link_' };
  } else if (params.status === 'inativo') {
    where.ativo = false;
  }

  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      include: { condominio: { select: { nome: true } } },
      orderBy: [{ condominio_id: 'asc' }, { created_at: 'desc' }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.user.count({ where }),
  ]);

  return { items, total, page: params.page, pageSize: params.pageSize };
}

export interface UpdateUserInput {
  nome?: string;
  role?: CreatableRole;
  ativo?: boolean;
}

export async function updateUser(id: string, data: UpdateUserInput) {
  return db.user.update({
    where: { id },
    data: {
      ...(data.nome !== undefined && { nome: data.nome.trim() }),
      ...(data.role !== undefined && { role: data.role }),
      ...(data.ativo !== undefined && { ativo: data.ativo }),
    },
  });
}

export async function getUserById(id: string) {
  return db.user.findUnique({ where: { id } });
}
