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

// IMPORTANTE: runtime usa DATABASE_RUNTIME_URL (role app_runtime — sujeita a RLS).
// DATABASE_URL é apenas para Prisma CLI (migrations) que precisa SUPERUSER.
// Fallback pra DATABASE_URL mantém compatibilidade pra dev sem RLS aplicado.
//
// Build-time fallback: Next.js 15 page data collection instancia client durante build
// mesmo em routes `force-dynamic`. Sem env DB no Dockerfile builder stage, Prisma falha
// com "Invalid value undefined for datasource". Placeholder URL permite build; runtime
// usa env real injetado pelo docker-compose prod.
const runtimeUrl =
  process.env.DATABASE_RUNTIME_URL ??
  process.env.DATABASE_URL ??
  'postgresql://buildtime:buildtime@localhost:5432/buildtime?schema=public';

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: runtimeUrl } },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
