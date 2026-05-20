'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SheetClose, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { userCreateSuperAdminSchema } from '@/lib/validators/user-create';

export interface CondominioOption {
  id: string;
  nome: string;
}

interface Props {
  condominios: CondominioOption[];
  onDone?: () => void;
}

export function AdminInviteForm({ condominios, onDone }: Props) {
  const router = useRouter();
  const [condominioId, setCondominioId] = useState(condominios[0]?.id ?? '');
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setServerError(null);
    setFieldErrors({});

    const parsed = userCreateSuperAdminSchema.safeParse({
      condominio_id: condominioId,
      email,
      nome,
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
      const res = await fetch('/api/super-admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setServerError(body.message ?? `Erro ${res.status}`);
        return;
      }
      setEmail('');
      setNome('');
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
        <SheetTitle>Cadastrar admin de condomínio</SheetTitle>
      </SheetHeader>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        <div className="space-y-1">
          <Label htmlFor="condominio_id">Condomínio</Label>
          <select
            id="condominio_id"
            value={condominioId}
            onChange={(e) => setCondominioId(e.target.value)}
            disabled={submitting || condominios.length === 0}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            aria-invalid={Boolean(fieldErrors.condominio_id)}
          >
            {condominios.length === 0 && <option value="">Nenhum condomínio ativo</option>}
            {condominios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          {fieldErrors.condominio_id?.[0] && (
            <p className="text-xs text-danger">{fieldErrors.condominio_id[0]}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="nome">Nome do admin</Label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Maria da Silva"
            disabled={submitting}
            aria-invalid={Boolean(fieldErrors.nome)}
          />
          {fieldErrors.nome?.[0] && <p className="text-xs text-danger">{fieldErrors.nome[0]}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@condominio.com.br"
            disabled={submitting}
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email?.[0] && <p className="text-xs text-danger">{fieldErrors.email[0]}</p>}
          <p className="text-xs text-text-secondary">
            O admin receberá um e-mail para criar a conta e definir a senha.
          </p>
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
        <Button type="submit" disabled={submitting || condominios.length === 0}>
          {submitting ? 'Salvando…' : 'Cadastrar admin'}
        </Button>
      </SheetFooter>
    </form>
  );
}
