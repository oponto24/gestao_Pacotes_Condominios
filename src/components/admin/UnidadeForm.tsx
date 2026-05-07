'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  SheetClose,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { unidadeCreateSchema } from '@/lib/validators/unidade';

export type UnidadeFormMode = 'create' | 'edit';

export interface UnidadeFormInitial {
  id?: string;
  identificador?: string;
  bloco?: string | null;
  observacoes?: string | null;
  ativo?: boolean;
}

interface Props {
  mode: UnidadeFormMode;
  initial?: UnidadeFormInitial;
  onDone?: () => void;
}

export function UnidadeForm({ mode, initial, onDone }: Props) {
  const router = useRouter();
  const [identificador, setIdentificador] = useState(initial?.identificador ?? '');
  const [bloco, setBloco] = useState(initial?.bloco ?? '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setServerError(null);
    setFieldErrors({});

    const parsed = unidadeCreateSchema.safeParse({
      identificador,
      bloco: bloco || undefined,
      observacoes: observacoes || undefined,
    });
    if (!parsed.success) {
      const errs: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path.join('.') || '_root';
        (errs[k] ??= []).push(issue.message);
      }
      setFieldErrors(errs);
      setSubmitting(false);
      return;
    }

    try {
      const isEdit = mode === 'edit' && initial?.id;
      const url = isEdit ? `/api/admin/unidades/${initial!.id}` : '/api/admin/unidades';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        fields?: Record<string, string[]>;
      };
      if (!res.ok) {
        if (body.fields) setFieldErrors(body.fields);
        setServerError(body.message ?? `Erro ${res.status}`);
        return;
      }
      router.refresh();
      onDone?.();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Falha de rede');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex h-full flex-col gap-4">
      <SheetHeader>
        <SheetTitle>{mode === 'edit' ? 'Editar unidade' : 'Nova unidade'}</SheetTitle>
      </SheetHeader>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        <div className="space-y-1">
          <Label htmlFor="identificador">Identificador</Label>
          <Input
            id="identificador"
            value={identificador}
            onChange={(e) => setIdentificador(e.target.value)}
            placeholder="101, Apto 301-B, Casa 12…"
            aria-invalid={Boolean(fieldErrors.identificador?.[0])}
            disabled={submitting}
          />
          {fieldErrors.identificador?.[0] && (
            <p className="text-xs text-danger">{fieldErrors.identificador[0]}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="bloco">Bloco (opcional)</Label>
          <Input
            id="bloco"
            value={bloco}
            onChange={(e) => setBloco(e.target.value)}
            placeholder="A, Torre 1, B…"
            aria-invalid={Boolean(fieldErrors.bloco?.[0])}
            disabled={submitting}
          />
          {fieldErrors.bloco?.[0] && <p className="text-xs text-danger">{fieldErrors.bloco[0]}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="observacoes">Observações (opcional)</Label>
          <Input
            id="observacoes"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex: morador prefere receber pacotes no portão lateral"
            aria-invalid={Boolean(fieldErrors.observacoes?.[0])}
            disabled={submitting}
          />
          {fieldErrors.observacoes?.[0] && (
            <p className="text-xs text-danger">{fieldErrors.observacoes[0]}</p>
          )}
        </div>

        {serverError && (
          <div role="alert" className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {serverError}
          </div>
        )}
      </div>

      <SheetFooter>
        <SheetClose asChild>
          <Button type="button" variant="secondary" disabled={submitting}>
            Cancelar
          </Button>
        </SheetClose>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando…' : mode === 'edit' ? 'Salvar alterações' : 'Criar unidade'}
        </Button>
      </SheetFooter>
    </form>
  );
}
