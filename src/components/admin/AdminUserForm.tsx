'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SheetClose, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { userCreateAdminSchema } from '@/lib/validators/user-create';

interface Props {
  role: 'admin_master' | 'porteiro';
  onDone?: () => void;
}

const COPY = {
  admin_master: {
    title: 'Cadastrar admin da equipe',
    button: 'Cadastrar admin',
    placeholder: 'Maria Síndica',
    helper: 'O admin receberá acesso ao painel assim que criar conta no Clerk com este e-mail.',
  },
  porteiro: {
    title: 'Cadastrar porteiro',
    button: 'Cadastrar porteiro',
    placeholder: 'João Portaria',
    helper: 'O porteiro entrará direto na tela /chegada após criar conta no Clerk com este e-mail.',
  },
} as const;

export function AdminUserForm({ role, onDone }: Props) {
  const router = useRouter();
  const copy = COPY[role];
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

    const parsed = userCreateAdminSchema.safeParse({ email, nome, role });
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
      const res = await fetch('/api/admin/users', {
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
        <SheetTitle>{copy.title}</SheetTitle>
      </SheetHeader>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        <div className="space-y-1">
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={copy.placeholder}
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
            placeholder="pessoa@exemplo.com.br"
            disabled={submitting}
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email?.[0] && <p className="text-xs text-danger">{fieldErrors.email[0]}</p>}
          <p className="text-xs text-text-secondary">{copy.helper}</p>
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
          {submitting ? 'Salvando…' : copy.button}
        </Button>
      </SheetFooter>
    </form>
  );
}
