'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { Building2 } from 'lucide-react';
import { BlocoForm, type BlocoFormInitial } from './BlocoForm';

export interface BlocoRow {
  id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
  _count: { unidades: number };
}

interface Props {
  rows: BlocoRow[];
  total: number;
  includeInativos: boolean;
}

export function BlocosListClient({ rows, total, includeInativos }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BlocoFormInitial | null>(null);

  function toggleInativos() {
    const next = new URLSearchParams(params);
    if (includeInativos) next.delete('inativos');
    else next.set('inativos', 'true');
    startTransition(() => router.push(`?${next.toString()}`));
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    const res = await fetch(`/api/admin/blocos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !ativo }),
    });
    if (!res.ok) {
      alert(ativo ? 'Falha ao desativar.' : 'Falha ao ativar.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Blocos</h1>
          <p className="text-sm text-text-secondary">{total} no total</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={toggleInativos}>
            {includeInativos ? 'Ocultar inativos' : 'Mostrar inativos'}
          </Button>
          <Sheet open={createOpen} onOpenChange={setCreateOpen}>
            <SheetTrigger asChild>
              <Button>Novo Bloco</Button>
            </SheetTrigger>
            <SheetContent>
              <BlocoForm mode="create" onDone={() => setCreateOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-12 w-12" aria-hidden />}
          title="Nenhum bloco cadastrado"
          description="Crie o primeiro bloco (ex: Bloco A, Torre 1) para organizar as unidades do condominio."
          action={
            <Sheet open={createOpen} onOpenChange={setCreateOpen}>
              <SheetTrigger asChild>
                <Button>Criar primeiro bloco</Button>
              </SheetTrigger>
              <SheetContent>
                <BlocoForm mode="create" onDone={() => setCreateOpen(false)} />
              </SheetContent>
            </Sheet>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((bloco) => (
            <div
              key={bloco.id}
              className="group relative rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <Link
                href={`/admin/blocos/${bloco.id}`}
                className="absolute inset-0 z-10"
                aria-label={`Ver detalhes do bloco ${bloco.nome}`}
              />
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium text-foreground">{bloco.nome}</h3>
                </div>
                {bloco.ativo ? (
                  <Badge variant="success">Ativo</Badge>
                ) : (
                  <Badge variant="muted">Inativo</Badge>
                )}
              </div>
              {bloco.descricao && (
                <p className="mt-1 line-clamp-2 text-sm text-text-secondary">
                  {bloco.descricao}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-text-secondary">
                  {bloco._count.unidades} unidade{bloco._count.unidades !== 1 ? 's' : ''}
                </span>
                <div className="relative z-20 flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      setEditTarget({
                        id: bloco.id,
                        nome: bloco.nome,
                        descricao: bloco.descricao,
                        ordem: bloco.ordem,
                      });
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      toggleAtivo(bloco.id, bloco.ativo);
                    }}
                  >
                    {bloco.ativo ? 'Desativar' : 'Ativar'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <SheetContent>
          {editTarget && (
            <BlocoForm mode="edit" initial={editTarget} onDone={() => setEditTarget(null)} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
