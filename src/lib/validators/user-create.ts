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

// Story 12.3: Super-admin editar/desativar usuario
export const userUpdateSuperAdminSchema = z.object({
  nome: z.string().trim().min(1, 'Nome obrigatório').max(200).optional(),
  role: z
    .enum(['admin_master', 'admin_funcionario', 'porteiro'], {
      message: 'Role inválido',
    })
    .optional(),
  ativo: z.boolean().optional(),
});

export type UserUpdateSuperAdminInput = z.infer<typeof userUpdateSuperAdminSchema>;

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['admin_master', 'admin_funcionario', 'porteiro']).optional(),
  condominio_id: z.string().uuid().optional(),
  status: z.enum(['ativo', 'pendente', 'inativo']).optional(),
  q: z.string().trim().min(1).optional(),
});
