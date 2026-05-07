'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
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
import type { PacoteForConfirmar } from '@/lib/db/pacote-confirmar';

const OUTRA_PESSOA = '__outra_pessoa__';

interface Props {
  pacote: PacoteForConfirmar;
}

/**
 * `<IAExtractionForm>` — tela de confirmação dos dados extraídos pela IA (story 3.8).
 *
 * - Campos textuais editáveis (pré-preenchidos pela IA)
 * - Selectors de unidade + destinatário (lista pré-fetched do server)
 * - "Outra pessoa" mantém destinatario_id=null e libera nome livre
 * - Indicador de confiança IA + banners (cep_diverge, pendente_identificacao)
 * - Submit → PATCH /api/pacotes/{id}/confirmar → redirect para /chegada/organizar/{id}
 */
export function IAExtractionForm({ pacote }: Props) {
  const router = useRouter();
  const [nome, setNome] = useState(pacote.nome_destinatario_etiqueta ?? '');
  const [endereco, setEndereco] = useState(pacote.endereco_etiqueta ?? '');
  const [cep, setCep] = useState(pacote.cep_etiqueta ?? '');
  const [complemento, setComplemento] = useState(pacote.complemento_etiqueta ?? '');
  const [remetente, setRemetente] = useState(pacote.remetente ?? '');
  const [unidadeId, setUnidadeId] = useState(pacote.unidade_id ?? '');
  const [destinatarioSel, setDestinatarioSel] = useState(
    pacote.destinatario_id ?? OUTRA_PESSOA,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moradoresUnidade = useMemo(
    () => pacote.moradores.filter((m) => m.unidade_id === unidadeId),
    [pacote.moradores, unidadeId],
  );

  const confianca = pacote.ia_confianca ?? 0;
  const confiancaColor =
    confianca >= 0.8 ? 'text-success' : confianca >= 0.5 ? 'text-warning' : 'text-danger';
  const confiancaPct = Math.round(confianca * 100);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nome.trim()) {
      setError('Nome do destinatário é obrigatório');
      return;
    }
    if (!unidadeId) {
      setError('Selecione uma unidade');
      return;
    }
    setSubmitting(true);
    try {
      const destinatario_id = destinatarioSel === OUTRA_PESSOA ? null : destinatarioSel;

      const res = await fetch(`/api/pacotes/${pacote.id}/confirmar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_destinatario: nome.trim(),
          endereco: endereco.trim() || null,
          cep: cep.trim() || null,
          complemento: complemento.trim() || null,
          remetente: remetente.trim() || null,
          unidade_id: unidadeId,
          destinatario_id,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok) throw new Error(body.message ?? `Erro HTTP ${res.status}`);

      router.push(`/chegada/organizar/${pacote.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao confirmar');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Confirmar dados</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Revise e ajuste antes de prosseguir.
        </p>
      </header>

      {/* Indicador de confiança */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <Sparkles className={`size-4 ${confiancaColor}`} aria-hidden />
        <span className="text-sm">
          IA confiança:{' '}
          <strong className={confiancaColor}>{confiancaPct}%</strong>
        </span>
      </div>

      {pacote.status === 'pendente_identificacao' && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            IA não conseguiu casar automaticamente. Selecione manualmente unidade e
            destinatário abaixo.
          </span>
        </div>
      )}

      {pacote.cep_diverge && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>CEP da etiqueta não bate com o do condomínio. Confirme.</span>
        </div>
      )}

      {/* Foto thumbnail (sem signed URL ainda — direct path; tech debt para 8.x) */}
      <div className="rounded-lg border border-border bg-background p-3">
        <p className="mb-2 text-xs font-medium text-text-secondary">Foto da etiqueta</p>
        <div className="rounded-md bg-muted px-3 py-2 text-xs text-text-secondary">
          {pacote.foto_storage_path}
          <span className="ml-2">({pacote.foto_mime_type})</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nome">Nome do destinatário *</Label>
        <Input
          id="nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoFocus={confianca < 0.5}
          required
          maxLength={200}
          disabled={submitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="unidade">Unidade *</Label>
        <Select
          value={unidadeId}
          onValueChange={(v) => {
            setUnidadeId(v);
            setDestinatarioSel(OUTRA_PESSOA);
          }}
          disabled={submitting}
        >
          <SelectTrigger id="unidade">
            <SelectValue placeholder="Selecione a unidade" />
          </SelectTrigger>
          <SelectContent>
            {pacote.unidades.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.bloco ? `Bloco ${u.bloco} · ` : ''}
                {u.identificador}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="destinatario">Destinatário cadastrado</Label>
        <Select
          value={destinatarioSel}
          onValueChange={setDestinatarioSel}
          disabled={submitting || !unidadeId}
        >
          <SelectTrigger id="destinatario">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {moradoresUnidade.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.nome} {m.is_principal ? '(principal)' : ''}
              </SelectItem>
            ))}
            <SelectItem value={OUTRA_PESSOA}>Outra pessoa (digite o nome acima)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <details className="rounded-lg border border-border bg-background">
        <summary className="cursor-pointer p-3 text-sm font-medium">
          Mais detalhes (endereço, CEP, complemento, remetente)
        </summary>
        <div className="space-y-3 border-t border-border p-3">
          <div className="space-y-1">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              maxLength={500}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cep">CEP</Label>
            <Input
              id="cep"
              value={cep}
              onChange={(e) => setCep(e.target.value)}
              placeholder="00000-000"
              maxLength={9}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="complemento">Complemento</Label>
            <Input
              id="complemento"
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
              maxLength={200}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="remetente">Remetente</Label>
            <Input
              id="remetente"
              value={remetente}
              onChange={(e) => setRemetente(e.target.value)}
              maxLength={200}
              disabled={submitting}
            />
          </div>
        </div>
      </details>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
        >
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/chegada')}
          disabled={submitting}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={submitting}
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
              Confirmar
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
