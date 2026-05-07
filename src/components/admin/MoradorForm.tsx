'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SheetClose,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { moradorCreateSchema } from '@/lib/validators/morador';

export type MoradorFormMode = 'create' | 'edit';

export interface MoradorFormInitial {
  id?: string;
  nome?: string;
  telefone?: string;
  email?: string | null;
  unidade_id?: string;
  is_principal?: boolean;
  ativo?: boolean;
}

export interface UnidadeOption {
  id: string;
  identificador: string;
  bloco: string | null;
}

interface Props {
  mode: MoradorFormMode;
  initial?: MoradorFormInitial;
  unidades: UnidadeOption[]; // dropdown options (server fetch)
  onDone?: () => void;
}

function unidadeLabel(u: UnidadeOption): string {
  return u.bloco ? `${u.bloco} • ${u.identificador}` : u.identificador;
}

export function MoradorForm({ mode, initial, unidades, onDone }: Props) {
  const router = useRouter();
  const [nome, setNome] = useState(initial?.nome ?? '');
  const [telefone, setTelefone] = useState(initial?.telefone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [unidadeId, setUnidadeId] = useState(initial?.unidade_id ?? '');
  const [isPrincipal, setIsPrincipal] = useState(initial?.is_principal ?? false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setServerError(null);
    setFieldErrors({});

    // Em modo edit, validamos sem unidade_id (PATCH não aceita)
    const isEdit = mode === 'edit' && initial?.id;
    const payloadSchema = isEdit
      ? moradorCreateSchema.omit({ unidade_id: true }).partial()
      : moradorCreateSchema;

    const candidate = isEdit
      ? { nome, telefone, email: email || undefined, is_principal: isPrincipal }
      : { nome, telefone, email: email || undefined, unidade_id: unidadeId, is_principal: isPrincipal };

    const parsed = payloadSchema.safeParse(candidate);
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
      const url = isEdit ? `/api/admin/moradores/${initial!.id}` : '/api/admin/moradores';
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
        <SheetTitle>{mode === 'edit' ? 'Editar morador' : 'Novo morador'}</SheetTitle>
      </SheetHeader>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {mode === 'create' && (
          <div className="space-y-1">
            <Label htmlFor="unidade_id">Unidade</Label>
            <Select value={unidadeId} onValueChange={setUnidadeId} disabled={submitting}>
              <SelectTrigger id="unidade_id" aria-invalid={Boolean(fieldErrors.unidade_id?.[0])}>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {unidades.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-text-secondary">Nenhuma unidade ativa</div>
                ) : (
                  unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {unidadeLabel(u)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {fieldErrors.unidade_id?.[0] && (
              <p className="text-xs text-danger">{fieldErrors.unidade_id[0]}</p>
            )}
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="nome">Nome completo</Label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="João da Silva"
            aria-invalid={Boolean(fieldErrors.nome?.[0])}
            disabled={submitting}
          />
          {fieldErrors.nome?.[0] && <p className="text-xs text-danger">{fieldErrors.nome[0]}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="telefone">Telefone (WhatsApp)</Label>
          <Input
            id="telefone"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(11) 98765-4321"
            aria-invalid={Boolean(fieldErrors.telefone?.[0])}
            disabled={submitting}
          />
          {fieldErrors.telefone?.[0] && (
            <p className="text-xs text-danger">{fieldErrors.telefone[0]}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="email">E-mail (opcional)</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="joao@example.com"
            aria-invalid={Boolean(fieldErrors.email?.[0])}
            disabled={submitting}
          />
          {fieldErrors.email?.[0] && <p className="text-xs text-danger">{fieldErrors.email[0]}</p>}
        </div>

        <label className="flex items-center gap-2 rounded-md border p-3">
          <input
            type="checkbox"
            checked={isPrincipal}
            onChange={(e) => setIsPrincipal(e.target.checked)}
            disabled={submitting}
            className="h-4 w-4"
          />
          <span className="text-sm">
            <strong>Marcar como morador principal</strong> — recebe notificações WhatsApp como
            fallback. Se já houver outro principal nesta unidade, ele será desmarcado.
          </span>
        </label>

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
          {submitting ? 'Salvando…' : mode === 'edit' ? 'Salvar alterações' : 'Criar morador'}
        </Button>
      </SheetFooter>
    </form>
  );
}
