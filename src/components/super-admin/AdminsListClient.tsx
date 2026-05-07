'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { AdminInviteForm, type CondominioOption } from './AdminInviteForm';

export interface AdminRow {
  id: string;
  email: string;
  nome: string;
  condominio_id: string | null;
  condominio_nome: string | null;
  clerk_id: string;
  ativo: boolean;
  created_at: string;
  ultimo_login: string | null;
}

interface Props {
  rows: AdminRow[];
  condominios: CondominioOption[];
}

function isPending(clerk_id: string): boolean {
  return clerk_id.startsWith('pending_clerk_link_');
}

export function AdminsListClient({ rows, condominios }: Props) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Usuários (admins de condomínio)</h1>
          <p className="text-sm text-text-secondary">{rows.length} no total</p>
        </div>
        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetTrigger asChild>
            <Button>Cadastrar admin</Button>
          </SheetTrigger>
          <SheetContent>
            <AdminInviteForm condominios={condominios} onDone={() => setCreateOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-text-secondary">Nenhum admin cadastrado ainda.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Condomínio</TableHead>
              <TableHead>Status</TableHead>
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
                  <TableCell>{u.condominio_nome ?? '—'}</TableCell>
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
