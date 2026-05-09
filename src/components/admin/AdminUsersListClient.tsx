'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { AdminUserForm } from './AdminUserForm';

export interface AdminUserRow {
  id: string;
  email: string;
  nome: string;
  clerk_id: string;
  ativo: boolean;
  created_at: string;
  ultimo_login: string | null;
}

interface Props {
  rows: AdminUserRow[];
  role: 'admin_master' | 'porteiro';
}

const TITLES = {
  admin_master: { heading: 'Equipe (admins do condomínio)', cta: 'Adicionar admin' },
  porteiro: { heading: 'Funcionários (porteiros)', cta: 'Adicionar porteiro' },
} as const;

function isPending(clerk_id: string): boolean {
  return clerk_id.startsWith('pending_clerk_link_');
}

export function AdminUsersListClient({ rows, role }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const t = TITLES[role];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t.heading}</h1>
          <p className="text-sm text-text-secondary">{rows.length} no total</p>
        </div>
        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetTrigger asChild>
            <Button>{t.cta}</Button>
          </SheetTrigger>
          <SheetContent>
            <AdminUserForm role={role} onDone={() => setCreateOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-text-secondary">
            Nenhum {role === 'admin_master' ? 'admin' : 'porteiro'} cadastrado ainda.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead>Último login</TableHead>
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
                    {pending ? (
                      <Badge variant="warning">Aguardando 1º login</Badge>
                    ) : u.ativo ? (
                      <Badge variant="success">Ativo</Badge>
                    ) : (
                      <Badge variant="muted">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-text-secondary">
                    {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-text-secondary">
                    {u.ultimo_login
                      ? new Date(u.ultimo_login).toLocaleDateString('pt-BR')
                      : '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
