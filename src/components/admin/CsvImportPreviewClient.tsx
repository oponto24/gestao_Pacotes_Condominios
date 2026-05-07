'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
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
import { AlertCircle, ArrowLeft, CheckCircle2, Download, FileWarning } from 'lucide-react';

/**
 * Tela de preview do CSV (story 2.6).
 *
 * Lê `sessionStorage['csvImportResult']` (salvo pela 2.5), faz validação
 * cross-DB, mostra preview com 3 status (válida / parcial / inválida) e
 * permite confirmar commit transacional ou baixar CSV de erros.
 */

const SESSION_KEY = 'csvImportResult';

interface ValidRow {
  linha: number;
  bloco?: string;
  identificador: string;
  morador_nome: string;
  morador_telefone: string;
  morador_email?: string;
}

interface InvalidRow {
  linha: number;
  raw: Record<string, string>;
  errors: string[];
}

interface ParsedResult {
  kind: 'parsed';
  valid: ValidRow[];
  invalid: InvalidRow[];
  totalRows: number;
}

type DbConflictReason = 'UNIDADE_EXISTE' | 'TELEFONE_EXISTE';

interface ConflictRow extends ValidRow {
  dbConflicts: DbConflictReason[];
}

interface DbValidationResult {
  okToCreate: ValidRow[];
  conflicting: ConflictRow[];
}

type Status = 'valid' | 'partial' | 'invalid';

interface DisplayRow {
  linha: number;
  bloco?: string;
  identificador: string;
  morador_nome?: string;
  morador_telefone?: string;
  morador_email?: string;
  status: Status;
  errors: string[];
  raw?: Record<string, string>;
}

const CONFLICT_LABEL: Record<DbConflictReason, string> = {
  UNIDADE_EXISTE: 'Unidade já cadastrada no condomínio',
  TELEFONE_EXISTE: 'Telefone já cadastrado em outro morador',
};

export function CsvImportPreviewClient() {
  const router = useRouter();
  const [parsed, setParsed] = useState<ParsedResult | null>(null);
  const [dbResult, setDbResult] = useState<DbValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Carregar do sessionStorage no mount
  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as ParsedResult;
      if (data.kind !== 'parsed') return;
      setParsed(data);
    } catch {
      // ignore
    }
  }, []);

  // Auto-validar contra DB quando parsed carrega
  useEffect(() => {
    if (!parsed || dbResult) return;
    if (parsed.valid.length === 0) {
      setDbResult({ okToCreate: [], conflicting: [] });
      return;
    }
    setValidating(true);
    fetch('/api/admin/csv-import/validate-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: parsed.valid }),
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as Partial<DbValidationResult> & {
          message?: string;
        };
        if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
        setDbResult(body as DbValidationResult);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setValidating(false));
  }, [parsed, dbResult]);

  // Compor lista de exibição (ordem do arquivo: linha asc)
  const displayRows: DisplayRow[] = useMemo(() => {
    if (!parsed) return [];
    const rows: DisplayRow[] = [];

    // Inválidas (parser-rejected)
    parsed.invalid.forEach((r) => {
      rows.push({
        linha: r.linha,
        bloco: r.raw.bloco,
        identificador: r.raw.identificador ?? '',
        morador_nome: r.raw.morador_nome,
        morador_telefone: r.raw.morador_telefone,
        morador_email: r.raw.morador_email,
        status: 'invalid',
        errors: r.errors,
        raw: r.raw,
      });
    });

    // Válidas (com possível conflito DB)
    if (dbResult) {
      const conflictByLinha = new Map(dbResult.conflicting.map((c) => [c.linha, c]));
      parsed.valid.forEach((r) => {
        const conflict = conflictByLinha.get(r.linha);
        if (conflict) {
          rows.push({
            ...r,
            status: 'partial',
            errors: conflict.dbConflicts.map((c) => CONFLICT_LABEL[c]),
          });
        } else {
          rows.push({ ...r, status: 'valid', errors: [] });
        }
      });
    } else {
      // Ainda validando DB — mostra como pendente (treat valid)
      parsed.valid.forEach((r) => {
        rows.push({ ...r, status: 'valid', errors: [] });
      });
    }

    rows.sort((a, b) => a.linha - b.linha);
    return rows;
  }, [parsed, dbResult]);

  const counts = useMemo(() => {
    if (!parsed || !dbResult) return null;
    return {
      okToCreate: dbResult.okToCreate.length,
      conflicting: dbResult.conflicting.length,
      invalid: parsed.invalid.length,
    };
  }, [parsed, dbResult]);

  async function handleCommit() {
    if (!dbResult || dbResult.okToCreate.length === 0) return;
    setCommitting(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/csv-import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: dbResult.okToCreate }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        created?: { unidades: number; moradores: number };
        message?: string;
      };

      if (!res.ok || !body.ok) {
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }

      sessionStorage.removeItem(SESSION_KEY);
      const u = body.created?.unidades ?? 0;
      const m = body.created?.moradores ?? 0;
      alert(`✅ Importação concluída: ${u} unidades + ${m} moradores criados`);
      router.push('/admin/moradores');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no commit');
      setCommitting(false);
      setShowConfirm(false);
    }
  }

  function handleDownloadErrors() {
    if (!parsed) return;
    const errorRows: Array<Record<string, string>> = [];

    parsed.invalid.forEach((r) => {
      errorRows.push({ ...r.raw, erro: r.errors.join('; ') });
    });

    dbResult?.conflicting.forEach((r) => {
      errorRows.push({
        bloco: r.bloco ?? '',
        identificador: r.identificador,
        morador_nome: r.morador_nome,
        morador_telefone: r.morador_telefone,
        morador_email: r.morador_email ?? '',
        erro: r.dbConflicts.map((c) => CONFLICT_LABEL[c]).join('; '),
      });
    });

    if (errorRows.length === 0) return;

    const csv = Papa.unparse(errorRows, { header: true });
    // BOM para Excel BR ler UTF-8 com acentos
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date()
      .toISOString()
      .replace(/[-:T]/g, '')
      .slice(0, 13);
    a.download = `import-erros-${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Empty state — usuário entrou direto na URL sem upload
  if (!parsed) {
    return (
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-2xl font-semibold text-foreground">Preview da Importação</h1>
        <div className="rounded-lg border border-dashed border-border bg-background p-8 text-center">
          <FileWarning className="mx-auto h-12 w-12 text-text-secondary" />
          <p className="mt-4 text-sm text-text-secondary">
            Nenhuma análise de CSV encontrada nesta sessão. Faça o upload do arquivo primeiro.
          </p>
          <Button className="mt-4" onClick={() => router.push('/admin/cadastros/importar')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Ir para upload
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Preview da Importação</h1>
          <p className="text-sm text-text-secondary">
            Revise o conteúdo antes de confirmar. Apenas linhas marcadas como{' '}
            <strong>válidas</strong> serão criadas — linhas com conflito ou erro são puladas.
          </p>
        </div>
        <Button variant="secondary" onClick={() => router.push('/admin/cadastros/importar')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Subir outro arquivo
        </Button>
      </div>

      {/* Resumo */}
      <div className="flex flex-wrap items-center gap-3">
        {counts && (
          <>
            <Badge variant="success" className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> {counts.okToCreate} criar
            </Badge>
            {counts.conflicting > 0 && (
              <Badge variant="warning" className="gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> {counts.conflicting} conflitos com banco
              </Badge>
            )}
            {counts.invalid > 0 && (
              <Badge variant="danger" className="gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> {counts.invalid} inválidas
              </Badge>
            )}
            <Badge variant="muted">{parsed.totalRows} linhas no total</Badge>
          </>
        )}
        {validating && <span className="text-sm text-text-secondary">Validando contra banco...</span>}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="text-sm text-destructive">{error}</div>
        </div>
      )}

      {/* Tabela */}
      <div className="rounded-lg border border-border bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Linha</TableHead>
              <TableHead>Bloco</TableHead>
              <TableHead>Identificador</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((row) => (
              <TableRow key={row.linha}>
                <TableCell className="font-mono text-xs">{row.linha}</TableCell>
                <TableCell>{row.bloco ?? '—'}</TableCell>
                <TableCell>{row.identificador}</TableCell>
                <TableCell>{row.morador_nome}</TableCell>
                <TableCell className="font-mono text-xs">{row.morador_telefone}</TableCell>
                <TableCell className="text-xs">{row.morador_email ?? '—'}</TableCell>
                <TableCell>
                  {row.status === 'valid' && <Badge variant="success">Válida</Badge>}
                  {row.status === 'partial' && (
                    <div className="space-y-1">
                      <Badge variant="warning">Conflito</Badge>
                      <div className="text-xs text-text-secondary">{row.errors.join(' · ')}</div>
                    </div>
                  )}
                  {row.status === 'invalid' && (
                    <div className="space-y-1">
                      <Badge variant="danger">Inválida</Badge>
                      <div className="text-xs text-text-secondary">{row.errors.join(' · ')}</div>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Ações */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
        {(counts?.invalid ?? 0) + (counts?.conflicting ?? 0) > 0 && (
          <Button variant="secondary" onClick={handleDownloadErrors}>
            <Download className="mr-2 h-4 w-4" />
            Baixar CSV de erros
          </Button>
        )}
        <div className="flex-1" />
        <Button
          onClick={() => setShowConfirm(true)}
          disabled={!dbResult || dbResult.okToCreate.length === 0 || committing || validating}
        >
          {committing
            ? 'Importando...'
            : `Confirmar importação (${dbResult?.okToCreate.length ?? 0})`}
        </Button>
      </div>

      {/* Modal de confirmação simplificado */}
      {showConfirm && dbResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 space-y-4">
            <h2 className="text-lg font-semibold">Confirmar importação</h2>
            <p className="text-sm text-text-secondary">
              Vai criar <strong>{dbResult.okToCreate.length} unidades</strong> +{' '}
              <strong>{dbResult.okToCreate.length} moradores principais</strong> em transação
              atômica. Continuar?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowConfirm(false)} disabled={committing}>
                Cancelar
              </Button>
              <Button onClick={handleCommit} disabled={committing}>
                {committing ? 'Importando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
