'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, MapPin, User, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import type { PacoteRetirada } from '@/lib/db/pacote-retirada';

interface Props {
  pacote: PacoteRetirada;
}

export function RetiradaConfirmarClient({ pacote }: Props) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [terceiroNome, setTerceiroNome] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destinatarioNome = pacote.destinatario?.nome ?? pacote.nome_destinatario_etiqueta ?? 'Destinatário';
  const unidadeLabel = pacote.unidade
    ? `${pacote.unidade.bloco ? `Bloco ${pacote.unidade.bloco} · ` : ''}${pacote.unidade.identificador}`
    : 'Unidade';

  async function confirmar(proprio: boolean, nomeTerceiro?: string) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/pacotes/${pacote.id}/retirar/confirmar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proprio_destinatario: proprio,
          retirado_por_terceiro: nomeTerceiro ?? null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(200);
      }
      router.push(`/retirada/sucesso?destinatario=${encodeURIComponent(destinatarioNome)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao confirmar');
      setSubmitting(false);
      setSheetOpen(false);
    }
  }

  function handleTerceiroSubmit() {
    if (terceiroNome.trim().length < 3) return;
    confirmar(false, terceiroNome.trim());
  }

  return (
    <div className="space-y-4 pb-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Confirmar entrega</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Confira os dados antes de entregar o pacote.
        </p>
      </header>

      <div className="space-y-3 rounded-lg border border-border bg-background p-4">
        <div className="flex items-start gap-3">
          <User className="mt-0.5 size-5 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-text-secondary">Destinatário</p>
            <p className="text-lg font-semibold">{destinatarioNome}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 size-5 text-accent" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-text-secondary">Unidade</p>
            <p className="font-medium">{unidadeLabel}</p>
          </div>
        </div>

        {(pacote.setor || pacote.posicao) && (
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-5 text-text-secondary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-text-secondary">Onde está</p>
              <p className="font-medium">
                {pacote.setor?.nome ?? '—'}
                {pacote.posicao && ` · ${pacote.posicao}`}
              </p>
            </div>
          </div>
        )}

        {pacote.remetente && (
          <div className="border-t border-border pt-3 text-xs text-text-secondary">
            Remetente: <strong>{pacote.remetente}</strong>
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-background p-4">
        <p className="text-sm font-medium">É o próprio destinatário que está retirando?</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={() => confirmar(true)}
            disabled={submitting || !pacote.destinatario}
            aria-busy={submitting}
            className="h-12 flex-1 text-base"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Confirmando…
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 size-4" aria-hidden />
                Sim, é {pacote.destinatario?.nome ?? 'destinatário'}
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setSheetOpen(true)}
            disabled={submitting}
            className="h-12 flex-1"
          >
            Não, outra pessoa
          </Button>
        </div>
        {!pacote.destinatario && (
          <p className="text-xs text-warning">
            Pacote sem destinatário cadastrado — registre o nome de quem está retirando.
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
        >
          {error}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="space-y-4">
          <SheetHeader>
            <SheetTitle>Quem está retirando?</SheetTitle>
            <SheetDescription>
              Digite o nome de quem veio buscar (terceiro autorizado).
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-2">
            <Label htmlFor="terceiro">Nome de quem retira</Label>
            <Input
              id="terceiro"
              value={terceiroNome}
              onChange={(e) => setTerceiroNome(e.target.value)}
              maxLength={200}
              placeholder="Ex: Maria Silva (vizinha)"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSheetOpen(false)}
              disabled={submitting}
              className="flex-1"
            >
              Voltar
            </Button>
            <Button
              type="button"
              onClick={handleTerceiroSubmit}
              disabled={submitting || terceiroNome.trim().length < 3}
              aria-busy={submitting}
              className="h-12 flex-[2] text-base"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Confirmando…
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 size-4" aria-hidden />
                  Confirmar entrega
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
