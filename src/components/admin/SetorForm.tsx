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
import { setorCreateSchema } from '@/lib/validators/setor';

export type SetorFormMode = 'create' | 'edit';

export interface SetorFormInitial {
  id?: string;
  nome?: string;
  descricao?: string | null;
  capacidade?: number | null;
  ativo?: boolean;
}

interface Props {
  mode: SetorFormMode;
  initial?: SetorFormInitial;
  onDone?: () => void;
}

export function SetorForm({ mode, initial, onDone }: Props) {
  const router = useRouter();
  const [nome, setNome] = useState(initial?.nome ?? '');
  const [descricao, setDescricao] = useState(initial?.descricao ?? '');
  const [capacidade, setCapacidade] = useState<string>(
    initial?.capacidade != null ? String(initial.capacidade) : '',
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setServerError(null);
    setFieldErrors({});

    const parsed = setorCreateSchema.safeParse({
      nome,
      descricao: descricao || undefined,
      capacidade: capacidade || undefined,
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
      const url = isEdit ? `/api/admin/setores/${initial!.id}` : '/api/admin/setores';
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
        <SheetTitle>{mode === 'edit' ? 'Editar setor' : 'Novo setor'}</SheetTitle>
      </SheetHeader>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        <div className="space-y-1">
          <Label htmlFor="nome">Nome do setor</Label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Bloco A, Salão de Festas, Sala de Triagem…"
            aria-invalid={Boolean(fieldErrors.nome?.[0])}
            disabled={submitting}
          />
          {fieldErrors.nome?.[0] && <p className="text-xs text-danger">{fieldErrors.nome[0]}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="descricao">Descrição (opcional)</Label>
          <Input
            id="descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: armário de pacotes pequenos próximo à portaria"
            aria-invalid={Boolean(fieldErrors.descricao?.[0])}
            disabled={submitting}
          />
          {fieldErrors.descricao?.[0] && <p className="text-xs text-danger">{fieldErrors.descricao[0]}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="capacidade">Capacidade máxima (opcional)</Label>
          <Input
            id="capacidade"
            type="number"
            min="1"
            max="9999"
            value={capacidade}
            onChange={(e) => setCapacidade(e.target.value)}
            placeholder="Ex: 50"
            aria-invalid={Boolean(fieldErrors.capacidade?.[0])}
            disabled={submitting}
          />
          {fieldErrors.capacidade?.[0] && <p className="text-xs text-danger">{fieldErrors.capacidade[0]}</p>}
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
          {submitting ? 'Salvando…' : mode === 'edit' ? 'Salvar alterações' : 'Criar setor'}
        </Button>
      </SheetFooter>
    </form>
  );
}
