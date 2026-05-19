'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  CheckCircle2,
  Key,
  Loader2,
  Mail,
  Package,
  PackageOpen,
  Truck,
} from 'lucide-react';
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
import type { PacoteForOrganizar } from '@/lib/db/pacote-organizar';
import { cn } from '@/lib/utils';

type Tamanho = 'pequeno' | 'medio' | 'grande' | 'extra_grande';

const TAMANHOS: Array<{
  value: Tamanho;
  label: string;
  hint: string;
  icon: typeof Mail;
}> = [
  { value: 'pequeno', label: 'Pequeno', hint: 'envelope, livro', icon: Mail },
  { value: 'medio', label: 'Médio', hint: 'caixa de sapato', icon: Package },
  { value: 'grande', label: 'Grande', hint: 'caixa de notebook', icon: PackageOpen },
  { value: 'extra_grande', label: 'Extra Grande', hint: 'TV, eletrodoméstico', icon: Truck },
];

interface PalavraChaveInfo {
  id: string;
  codigo: string;
  morador_nome: string;
  expira_em: Date;
  descricao: string | null;
}

interface Props {
  pacote: PacoteForOrganizar;
  palavrasChave?: PalavraChaveInfo[];
}

export function OrganizarForm({ pacote, palavrasChave = [] }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  // Story 10.5: se está sendo usado em /administracao, retornar pra lista admin
  const isAdminContext = pathname?.startsWith('/administracao') ?? false;
  const [tamanho, setTamanho] = useState<Tamanho | null>(
    (pacote.tamanho as Tamanho | null) ?? null,
  );
  const [setorId, setSetorId] = useState(pacote.setor_id ?? '');
  const [posicao, setPosicao] = useState(pacote.posicao ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!tamanho && !!setorId && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tamanho || !setorId) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/pacotes/${pacote.id}/organizar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tamanho,
          setor_id: setorId,
          posicao: posicao.trim() || null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok) throw new Error(body.message ?? `Erro HTTP ${res.status}`);

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(150);
      }
      router.push(isAdminContext ? '/administracao/organizar' : '/chegada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao organizar');
      setSubmitting(false);
    }
  }

  if (pacote.setores.length === 0) {
    return (
      <div className="space-y-4 pb-8">
        <h1 className="text-2xl font-semibold text-foreground">Organizar pacote</h1>
        <div
          role="alert"
          className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm"
        >
          <p className="font-medium">Nenhum setor cadastrado.</p>
          <p className="mt-1 text-text-secondary">
            Peça ao admin para cadastrar pelo menos um setor de armazenamento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Organizar pacote</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {pacote.nome_destinatario_etiqueta}
          {pacote.unidade_label && ` · ${pacote.unidade_label}`}
        </p>
      </header>

      {palavrasChave.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
          <div className="flex items-start gap-2">
            <Key className="mt-0.5 size-4 text-warning" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-warning">
                Palavra-chave pendente pra esta unidade
              </p>
              <ul className="mt-2 space-y-1.5">
                {palavrasChave.map((pc) => {
                  const dias = Math.max(
                    0,
                    Math.ceil(
                      (new Date(pc.expira_em).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
                    ),
                  );
                  return (
                    <li key={pc.id} className="flex items-center gap-2 text-sm">
                      <code className="rounded bg-warning/10 px-2 py-0.5 font-bold tracking-wider text-warning">
                        {pc.codigo}
                      </code>
                      <span className="text-text-secondary">
                        {pc.morador_nome}
                        {pc.descricao && ` · ${pc.descricao}`}
                      </span>
                      <span
                        className={cn(
                          'ml-auto text-xs',
                          dias <= 3 ? 'text-danger' : 'text-text-secondary',
                        )}
                      >
                        {dias}d
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Tamanho *</Label>
        <div className="grid grid-cols-2 gap-2">
          {TAMANHOS.map((t) => {
            const Icon = t.icon;
            const selected = tamanho === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTamanho(t.value)}
                aria-pressed={selected}
                disabled={submitting}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
                  'hover:bg-muted/40',
                  selected
                    ? 'border-primary bg-primary/10 ring-2 ring-primary'
                    : 'border-border bg-background',
                )}
              >
                <Icon
                  className={cn('size-5', selected ? 'text-primary' : 'text-text-secondary')}
                  aria-hidden
                />
                <span className="font-medium">{t.label}</span>
                <span className="text-xs text-text-secondary">{t.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="setor">Setor *</Label>
        <Select value={setorId} onValueChange={setSetorId} disabled={submitting}>
          <SelectTrigger id="setor">
            <SelectValue placeholder="Selecione o setor" />
          </SelectTrigger>
          <SelectContent>
            {pacote.setores.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.nome}
                {s.descricao && (
                  <span className="ml-2 text-xs text-text-secondary">{s.descricao}</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="posicao">Posição (opcional)</Label>
        <Input
          id="posicao"
          value={posicao}
          onChange={(e) => setPosicao(e.target.value)}
          placeholder="ex: prateleira 3, B-12"
          maxLength={50}
          disabled={submitting}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
        >
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={!canSubmit}
        aria-busy={submitting}
        className="h-12 w-full text-base"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            Concluindo…
          </>
        ) : (
          <>
            <CheckCircle2 className="mr-2 size-4" aria-hidden />
            Concluir
          </>
        )}
      </Button>
    </form>
  );
}
