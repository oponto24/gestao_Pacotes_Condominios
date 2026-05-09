import { z } from 'zod';

/**
 * Validador para criação de user via UI (stories 8.5/8.6/8.7).
 *
 * Super-admin usa schemaWithCond (define cond_id no body).
 * Admin usa schemaWithRole (cond_id vem do tenant context, role limitada).
 */

export const userCreateSuperAdminSchema = z.object({
  condominio_id: z.string().uuid('Condomínio inválido'),
  email: z.string().email('E-mail inválido').max(200),
  nome: z.string().trim().min(1, 'Nome obrigatório').max(200),
});

export const userCreateAdminSchema = z.object({
  email: z.string().email('E-mail inválido').max(200),
  nome: z.string().trim().min(1, 'Nome obrigatório').max(200),
  role: z.enum(['admin_master', 'admin_funcionario', 'porteiro'], {
    message: 'Role inválido (apenas admin_master, admin_funcionario ou porteiro)',
  }),
});

export type UserCreateSuperAdminInput = z.infer<typeof userCreateSuperAdminSchema>;
export type UserCreateAdminInput = z.infer<typeof userCreateAdminSchema>;
