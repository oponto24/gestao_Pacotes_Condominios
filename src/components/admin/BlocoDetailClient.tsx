'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Building2, ArrowLeft } from 'lucide-react';
import { BlocoForm, type BlocoFormInitial } from './BlocoForm';
import { UnidadeForm, type BlocoOption } from './UnidadeForm';

interface UnidadeRow {
  id: string;
  identificador: string;
  ativo: boolean;
  _count: { moradores: number };
}

interface BlocoDetail {
  id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
  _count: { unidades: number };
  unidades: UnidadeRow[];
}

interface Props {
  bloco: BlocoDetail;
}

export function BlocoDetailClient({ bloco }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [createUnidadeOpen, setCreateUnidadeOpen] = useState(false);

  const blocoOption: BlocoOption[] = [{ id: bloco.id, nome: bloco.nome }];

  const editInitial: BlocoFormInitial = {
    id: bloco.id,
    nome: bloco.nome,
    descricao: bloco.descricao,
    ordem: bloco.ordem,
  };

  async function handleDesativar() {
    if (!confirm(`Desativar o bloco "${bloco.nome}"?`)) return;
    const res = await fetch(`/api/admin/blocos/${bloco.id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Falha ao desativar.');
      return;
    }
    router.push('/admin/blocos');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/blocos">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar
            </Button>
          </Link>
          <Building2 className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{bloco.nome}</h1>
            {bloco.descricao && (
              <p className="text-sm text-text-secondary">{bloco.descricao}</p>
            )}
          </div>
          {bloco.ativo ? (
            <Badge variant="success">Ativo</Badge>
          ) : (
            <Badge variant="muted">Inativo</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            Editar
          </Button>
          {bloco.ativo && (
            <Button variant="danger" onClick={handleDesativar}>
              Desativar
            </Button>
          )}
        </div>
      </div>

      {/* Unidades */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-medium text-foreground">
            Unidades ({bloco._count.unidades})
          </h2>
          <Button size="sm" onClick={() => setCreateUnidadeOpen(true)}>
            Nova unidade
          </Button>
        </div>
        {bloco.unidades.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Nenhuma unidade vinculada a este bloco. Clique em &quot;Nova unidade&quot; para criar.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identificador</TableHead>
                <TableHead className="text-right">Moradores</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bloco.unidades.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/unidades?bloco_id=${bloco.id}`}
                      className="hover:underline"
                    >
                      {u.identificador}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{u._count.moradores}</TableCell>
                  <TableCell>
                    {u.ativo ? (
                      <Badge variant="success">Ativa</Badge>
                    ) : (
                      <Badge variant="muted">Inativa</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Edit Bloco Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent>
          <BlocoForm mode="edit" initial={editInitial} onDone={() => setEditOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Create Unidade Sheet */}
      <Sheet open={createUnidadeOpen} onOpenChange={setCreateUnidadeOpen}>
        <SheetContent>
          <UnidadeForm
            mode="create"
            blocos={blocoOption}
            initial={{ bloco_id: bloco.id }}
            onDone={() => {
              setCreateUnidadeOpen(false);
              router.refresh();
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
