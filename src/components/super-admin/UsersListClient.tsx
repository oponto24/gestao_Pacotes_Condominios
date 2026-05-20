'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { AdminInviteForm, type CondominioOption } from './AdminInviteForm';
import { UserEditForm } from './UserEditForm';

export interface UserRow {
  id: string;
  email: string;
  nome: string;
  role: string;
  condominio_id: string | null;
  condominio: { nome: string } | null;
  clerk_id: string;
  ativo: boolean;
  created_at: string;
  ultimo_login: string | null;
}

interface Props {
  rows: UserRow[];
  total: number;
  page: number;
  pageSize: number;
  condominios: CondominioOption[];
}

function isPending(clerk_id: string): boolean {
  return clerk_id.startsWith('pending_clerk_link_');
}

const ROLE_LABELS: Record<string, string> = {
  admin_master: 'Admin Master',
  admin_funcionario: 'Admin Func.',
  porteiro: 'Porteiro',
};

export function UsersListClient({ rows, total, page, pageSize, condominios }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function navigate(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete('page'); // reset page on filter change
    router.push(`?${next.toString()}`);
  }

  function goPage(p: number) {
    const next = new URLSearchParams(params);
    if (p > 1) next.set('page', String(p));
    else next.delete('page');
    router.push(`?${next.toString()}`);
  }

  async function toggleAtivo(user: UserRow) {
    const action = user.ativo ? 'Desativar' : 'Reativar';
    if (!confirm(`${action} "${user.nome}"?`)) return;
    const res = await fetch(`/api/super-admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !user.ativo }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Falha: ${body.message ?? res.status}`);
      return;
    }
    router.refresh();
  }

  async function resetPassword(user: UserRow) {
    const pending = isPending(user.clerk_id);
    const msg = pending
      ? `Criar acesso para "${user.email}"?`
      : `Resetar senha de "${user.email}"?`;
    if (!confirm(msg)) return;
    const res = await fetch(`/api/super-admin/users/${user.id}/send-email`, {
      method: 'POST',
    });
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      email?: string;
      tempPassword?: string;
    };
    if (!res.ok) {
      alert(`Falha: ${body.message ?? res.status}`);
      return;
    }
    if (body.tempPassword) {
      const credentials = `Email: ${body.email}\nSenha: ${body.tempPassword}`;
      await navigator.clipboard.writeText(credentials).catch(() => {});
      alert(`Credenciais copiadas:\n\n${credentials}\n\nEnvie ao usuário. Ele pode alterar a senha depois.`);
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Usuários</h1>
          <p className="text-sm text-text-secondary">{total} no total</p>
        </div>
        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetTrigger asChild>
            <Button>Cadastrar usuário</Button>
          </SheetTrigger>
          <SheetContent>
            <AdminInviteForm condominios={condominios} onDone={() => setCreateOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar nome ou email..."
          defaultValue={params.get('q') ?? ''}
          className="w-56"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = (e.target as HTMLInputElement).value.trim();
              navigate({ q: val || undefined });
            }
          }}
        />
        <Select
          value={params.get('role') ?? 'all'}
          onValueChange={(v) => navigate({ role: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas roles</SelectItem>
            <SelectItem value="admin_master">Admin Master</SelectItem>
            <SelectItem value="admin_funcionario">Admin Func.</SelectItem>
            <SelectItem value="porteiro">Porteiro</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={params.get('condominio_id') ?? 'all'}
          onValueChange={(v) => navigate({ condominio_id: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Condomínio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos condomínios</SelectItem>
            {condominios.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={params.get('status') ?? 'all'}
          onValueChange={(v) => navigate({ status: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-text-secondary">Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Condomínio</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => {
              const pending = isPending(u.clerk_id);
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome}</TableCell>
                  <TableCell className="text-text-secondary">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="muted">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                  </TableCell>
                  <TableCell>{u.condominio?.nome ?? '—'}</TableCell>
                  <TableCell>
                    {pending ? (
                      <Badge variant="warning">Pendente</Badge>
                    ) : u.ativo ? (
                      <Badge variant="success">Ativo</Badge>
                    ) : (
                      <Badge variant="muted">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button variant="ghost" size="sm" onClick={() => resetPassword(u)}>
                      {pending ? 'Criar acesso' : 'Resetar senha'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditTarget(u)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleAtivo(u)}>
                      {u.ativo ? 'Desativar' : 'Reativar'}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-text-secondary">
            Página {page} de {totalPages}
          </span>
          {page > 1 && (
            <Button variant="ghost" size="sm" onClick={() => goPage(page - 1)}>
              Anterior
            </Button>
          )}
          {page < totalPages && (
            <Button variant="ghost" size="sm" onClick={() => goPage(page + 1)}>
              Próxima
            </Button>
          )}
        </div>
      )}

      {/* Edit Sheet */}
      <Sheet open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <SheetContent>
          {editTarget && (
            <UserEditForm user={editTarget} onDone={() => setEditTarget(null)} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
