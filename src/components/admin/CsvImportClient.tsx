'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ArrowRight, CheckCircle2, FileUp } from 'lucide-react';

/**
 * Cliente da tela /admin/cadastros/importar (story 2.5).
 *
 * Faz upload do CSV → POST /api/admin/csv-import/parse → exibe relatório.
 * Persiste o ParseResult em sessionStorage com chave `csvImportResult` para
 * a story 2.6 (preview + commit transacional) consumir.
 */

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

type ParseResult =
  | { kind: 'fatal'; code: string; details: string }
  | { kind: 'parsed'; valid: ValidRow[]; invalid: InvalidRow[]; totalRows: number };

const SESSION_KEY = 'csvImportResult';

export function CsvImportClient() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.set('file', file);

      const res = await fetch('/api/admin/csv-import/parse', {
        method: 'POST',
        body: formData,
      });

      const body = (await res.json()) as ParseResult | { ok: false; message?: string };

      if (!res.ok && 'kind' in body && body.kind === 'fatal') {
        setResult(body);
      } else if (!res.ok) {
        const msg = 'message' in body ? body.message : `HTTP ${res.status}`;
        setError(msg ?? `Falha ao processar arquivo (${res.status})`);
      } else if ('kind' in body) {
        setResult(body);
        // Persiste para a 2.6 consumir
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(body));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Importação CSV</h1>
        <p className="text-sm text-text-secondary">
          Suba um CSV com unidades + morador principal de cada uma. Este passo apenas{' '}
          <strong>analisa</strong> o arquivo — nada é salvo no banco até a confirmação.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-background p-4 space-y-3">
        <label className="block text-sm font-medium">Arquivo CSV</label>
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:opacity-90"
        />
        <p className="text-xs text-text-secondary">
          Formato esperado: <code className="rounded bg-muted px-1 py-0.5">bloco,identificador,morador_nome,morador_telefone,morador_email</code>{' '}
          · UTF-8 · até 1000 linhas / 256KB
        </p>
        <Button onClick={handleAnalyze} disabled={!file || loading}>
          <FileUp className="mr-2 h-4 w-4" />
          {loading ? 'Analisando...' : 'Analisar arquivo'}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="text-sm text-destructive">{error}</div>
        </div>
      )}

      {result?.kind === 'fatal' && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <div className="text-sm font-medium text-destructive">{result.code}</div>
            <p className="mt-1 text-sm text-text-secondary">{result.details}</p>
          </div>
        </div>
      )}

      {result?.kind === 'parsed' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Badge variant="success" className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> {result.valid.length} válidas
            </Badge>
            {result.invalid.length > 0 && (
              <Badge variant="danger" className="gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> {result.invalid.length} com erro
              </Badge>
            )}
            <Badge variant="muted">{result.totalRows} linhas no total</Badge>
          </div>

          {result.invalid.length > 0 && (
            <div className="rounded-lg border border-border bg-background">
              <div className="border-b border-border px-4 py-2 text-sm font-medium">
                Linhas com erro
              </div>
              <ul className="divide-y divide-border">
                {result.invalid.map((row) => (
                  <li key={row.linha} className="px-4 py-3 text-sm">
                    <div className="font-mono text-xs text-text-secondary">Linha {row.linha}</div>
                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                      {row.errors.map((err, i) => (
                        <li key={i} className="text-destructive">
                          {err}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.valid.length > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm">
                Pronto para revisar e confirmar a importação das{' '}
                <strong>{result.valid.length} linhas válidas</strong>.
              </p>
              <Button onClick={() => router.push('/admin/cadastros/importar/preview')}>
                Ir para preview
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
