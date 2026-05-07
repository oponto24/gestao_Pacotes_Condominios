import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import type { User } from '@prisma/client';

export type CurrentUser =
  | { kind: 'authenticated'; user: User }
  | { kind: 'pending_provisioning'; clerk_id: string }
  | null;

/**
 * Resolve o usuário atual combinando Clerk (auth) + Postgres (user table).
 *
 * - Não autenticado → null
 * - Autenticado mas webhook ainda não criou linha → { kind: 'pending_provisioning' }
 *   (acontece nos primeiros milissegundos após signup)
 * - Autenticado com user persistido → { kind: 'authenticated', user }
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await db.user.findUnique({ where: { clerk_id: userId } });
  if (!user) return { kind: 'pending_provisioning', clerk_id: userId };
  return { kind: 'authenticated', user };
}
