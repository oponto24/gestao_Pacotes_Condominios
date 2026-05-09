'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SheetClose, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { condominioCreateSchema } from '@/lib/validators/condominio';

export type CondominioFormMode = 'create' | 'edit';

export interface CondominioFormInitial {
  id?: string;
  nome?: string;
  cnpj?: string | null;
  endereco?: string;
  cep?: string;
  cidade?: string;
  estado?: string;
  contato_nome?: string;
  contato_telefone?: string;
  contato_email?: string | null;
  tem_administracao?: boolean;
}

interface Props {
  mode: CondominioFormMode;
  initial?: CondominioFormInitial;
  onDone?: () => void;
}

const FIELDS: Array<{ key: keyof CondominioFormInitial; label: string; type?: string; placeholder?: string }> = [
  { key: 'nome', label: 'Nome do condomínio', placeholder: 'Edifício Aurora' },
  { key: 'cnpj', label: 'CNPJ (opcional)', placeholder: '00.000.000/0000-00' },
  { key: 'endereco', label: 'Endereço', placeholder: 'Rua das Flores, 123' },
  { key: 'cep', label: 'CEP', placeholder: '01000-000' },
  { key: 'cidade', label: 'Cidade', placeholder: 'São Paulo' },
  { key: 'estado', label: 'UF', placeholder: 'SP' },
  { key: 'contato_nome', label: 'Nome do contato (síndico)', placeholder: 'Maria da Silva' },
  { key: 'contato_telefone', label: 'Telefone do contato', placeholder: '(11) 99999-9999' },
  { key: 'contato_email', label: 'E-mail do contato (opcional)', type: 'email', placeholder: 'sindico@example.com' },
];

export function CondominioForm({ mode, initial, onDone }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<CondominioFormInitial>({
    nome: initial?.nome ?? '',
    cnpj: initial?.cnpj ?? '',
    endereco: initial?.endereco ?? '',
    cep: initial?.cep ?? '',
    cidade: initial?.cidade ?? '',
    estado: initial?.estado ?? '',
    contato_nome: initial?.contato_nome ?? '',
    contato_telefone: initial?.contato_telefone ?? '',
    contato_email: initial?.contato_email ?? '',
    tem_administracao: initial?.tem_administracao ?? false,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends keyof CondominioFormInitial>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    if (fieldErrors[key as string]) {
      setFieldErrors((e) => {
        const next = { ...e };
        delete next[key as string];
        return next;
      });
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setServerError(null);
    setFieldErrors({});

    const parsed = condominioCreateSchema.safeParse(values);
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
      const url = isEdit ? `/api/admin/condominios/${initial!.id}` : '/api/admin/condominios';
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
        <SheetTitle>{mode === 'edit' ? 'Editar condomínio' : 'Novo condomínio'}</SheetTitle>
      </SheetHeader>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {FIELDS.map((field) => {
          const error = fieldErrors[field.key as string]?.[0];
          return (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                name={field.key}
                type={field.type ?? 'text'}
                placeholder={field.placeholder}
                value={(values[field.key] as string) ?? ''}
                onChange={(e) => setField(field.key, e.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${field.key}-error` : undefined}
                disabled={submitting}
              />
              {error && (
                <p id={`${field.key}-error`} className="text-xs text-danger">
                  {error}
                </p>
              )}
            </div>
          );
        })}

        {/* Story 10.3: toggle tem_administracao (Epic 10 — hierarquia operacional) */}
        <div className="space-y-1 rounded-md border border-border bg-muted/30 p-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={Boolean(values.tem_administracao)}
              onChange={(e) =>
                setValues((v) => ({ ...v, tem_administracao: e.target.checked }))
              }
              disabled={submitting}
            />
            <div>
              <span className="font-medium">Este condomínio tem equipe administrativa dedicada</span>
              <p className="text-xs text-text-secondary">
                Quando marcado, o porteiro recebe e confirma o pacote, mas a administração
                organiza setor/posição e dispara a notificação ao morador. Pode ser alterado
                a qualquer momento.
              </p>
            </div>
          </label>
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
          {submitting ? 'Salvando…' : mode === 'edit' ? 'Salvar alterações' : 'Criar condomínio'}
        </Button>
      </SheetFooter>
    </form>
  );
}
