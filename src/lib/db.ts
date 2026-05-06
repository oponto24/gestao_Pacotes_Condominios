import { PrismaClient } from '@prisma/client';

/**
 * Prisma client singleton (padrão Next.js).
 *
 * Evita criar múltiplas instâncias durante hot reload em dev — sem isso,
 * cada save de arquivo gera nova conexão até o pool estourar.
 *
 * Em produção, módulos não recarregam, então a primeira instância vive
 * pelo tempo do processo.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
