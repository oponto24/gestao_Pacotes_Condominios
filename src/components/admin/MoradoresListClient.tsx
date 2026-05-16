'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Star, Users, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { EmptyState } from '@/components/ui/empty-state';
import {
  MoradorForm,
  type MoradorFormInitial,
  type UnidadeOption,
} from './MoradorForm';

export interface MoradorRow {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  unidade_id: string;
  is_principal: boolean;
  ativo: boolean;
  deleted_at: string | null;
  unidade: { identificador: string; bloco: string | null };
  _count: { pacotes_destinatario: number };
}

interface Props {
  rows: MoradorRow[];
  total: number;
  unidades: UnidadeOption[];
  includeArquivados: boolean;
}

function unidadeLabel(u: { identificador: string; bloco: string | null }): string {
  return u.bloco ? `${u.bloco} • ${u.identificador}` : u.identificador;
}

export function MoradoresListClient({
  rows,
  total,
  unidades,
  includeArquivados,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MoradorFormInitial | null>(null);
  const [q, setQ] = useState('');
  const [blocoFilter, setBlocoFilter] = useState('__all__');

  // Derive unique blocos from unidades for the filter dropdown
  const blocos = useMemo(() => {
    const set = new Set<string>();
    unidades.forEach((u) => { if (u.bloco) set.add(u.bloco); });
    return Array.from(set).sort();
  }, [unidades]);

  // Client-side filtering
  const filteredRows = useMemo(() => {
    let result = rows;
    if (q.trim().length >= 2) {
      const lower = q.trim().toLowerCase();
      result = result.filter(
        (m) =>
          m.nome.toLowerCase().includes(lower) ||
          m.telefone.toLowerCase().includes(lower),
      );
    }
    if (blocoFilter !== '__all__') {
      result = result.filter((m) => m.unidade.bloco === blocoFilter);
    }
    return result;
  }, [rows, q, blocoFilter]);

  function toggleParam(key: string, currentValue: boolean) {
    const next = new URLSearchParams(params);
    if (currentValue) next.delete(key);
    else next.set(key, 'true');
    startTransition(() => router.push(`?${next.toString()}`));
  }

  async function marcarPrincipal(id: string, nome: string) {
    if (!confirm(`Marcar "${nome}" como principal? O atual principal da unidade será desmarcado.`)) return;
    const res = await fetch(`/api/admin/moradores/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_principal: true }),
    });
    if (!res.ok) {
      alert('Falha ao marcar como principal.');
      return;
    }
    router.refresh();
  }

  async function archive(id: string, nome: string) {
    if (
      !confirm(
        `Arquivar "${nome}" conforme LGPD?\n\nO morador ficará oculto da lista mas o histórico de pacotes/notificações é preservado. Você pode restaurar depois.`,
      )
    )
      return;
    const res = await fetch(`/api/admin/moradores/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      alert(body.message ?? 'Falha ao arquivar.');
      return;
    }
    router.refresh();
  }

  async function restore(id: string) {
    const res = await fetch(`/api/admin/moradores/${id}/restore`, { method: 'POST' });
    if (!res.ok) {
      alert('Falha ao restaurar.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Moradores</h1>
          <p className="text-sm text-text-secondary">{total} no total</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => toggleParam('arquivados', includeArquivados)}>
            {includeArquivados ? 'Ocultar arquivados' : 'Mostrar arquivados'}
          </Button>
          <Sheet open={createOpen} onOpenChange={setCreateOpen}>
            <SheetTrigger asChild>
              <Button>Novo morador</Button>
            </SheetTrigger>
            <SheetContent>
              <MoradorForm
                mode="create"
                unidades={unidades}
                onDone={() => setCreateOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou telefone…"
            className="pl-8 pr-8"
            maxLength={100}
          />
          {q && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setQ('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
        {blocos.length > 0 && (
          <Select value={blocoFilter} onValueChange={setBlocoFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Bloco" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os blocos</SelectItem>
              {blocos.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" aria-hidden />}
          title={q || blocoFilter !== '__all__' ? 'Nenhum morador encontrado' : 'Nenhum morador cadastrado'}
          description={
            q || blocoFilter !== '__all__'
              ? 'Tente ajustar os filtros de busca.'
              : unidades.length === 0
                ? 'Cadastre primeiro uma Unidade para depois adicionar moradores.'
                : 'Cadastre o morador principal de cada unidade. Eles vão receber notificações WhatsApp.'
          }
          action={
            unidades.length > 0 ? (
              <Sheet open={createOpen} onOpenChange={setCreateOpen}>
                <SheetTrigger asChild>
                  <Button>Cadastrar primeiro morador</Button>
                </SheetTrigger>
                <SheetContent>
                  <MoradorForm
                    mode="create"
                    unidades={unidades}
                    onDone={() => setCreateOpen(false)}
                  />
                </SheetContent>
              </Sheet>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Pacotes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((m) => {
              const arquivado = !!m.deleted_at;
              return (
                <TableRow key={m.id}>
                  <TableCell className="text-text-secondary">{unidadeLabel(m.unidade)}</TableCell>
                  <TableCell className="font-medium">{m.nome}</TableCell>
                  <TableCell>{m.telefone}</TableCell>
                  <TableCell className="text-text-secondary">{m.email ?? '—'}</TableCell>
                  <TableCell>
                    {m.is_principal ? (
                      <Badge variant="success">
                        <Star className="mr-1 h-3 w-3" aria-hidden /> Principal
                      </Badge>
                    ) : (
                      <Badge variant="muted">Adicional</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{m._count.pacotes_destinatario}</TableCell>
                  <TableCell>
                    {arquivado ? (
                      <Badge variant="muted">Arquivado</Badge>
                    ) : m.ativo ? (
                      <Badge variant="success">Ativo</Badge>
                    ) : (
                      <Badge variant="warning">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    {!arquivado && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setEditTarget(m)}>
                          Editar
                        </Button>
                        {!m.is_principal && (
                          <Button variant="ghost" size="sm" onClick={() => marcarPrincipal(m.id, m.nome)}>
                            Tornar principal
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => archive(m.id, m.nome)}>
                          Arquivar
                        </Button>
                      </>
                    )}
                    {arquivado && (
                      <Button variant="ghost" size="sm" onClick={() => restore(m.id)}>
                        Restaurar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Sheet open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <SheetContent>
          {editTarget && (
            <MoradorForm
              mode="edit"
              initial={editTarget}
              unidades={unidades}
              onDone={() => setEditTarget(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
