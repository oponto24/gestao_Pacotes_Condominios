'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

const ACOES = [
  { value: '', label: 'Todas as ações' },
  { value: 'impersonate_start', label: 'Impersonate iniciado' },
  { value: 'impersonate_stop', label: 'Impersonate encerrado' },
  { value: 'condominio_created', label: 'Condomínio criado' },
  { value: 'condominio_updated', label: 'Condomínio atualizado' },
  { value: 'condominio_archived', label: 'Condomínio arquivado' },
  { value: 'condominio_restored', label: 'Condomínio restaurado' },
  { value: 'condominio_deleted', label: 'Condomínio excluído' },
  { value: 'bloco_created', label: 'Bloco criado' },
  { value: 'bloco_updated', label: 'Bloco atualizado' },
  { value: 'bloco_deleted', label: 'Bloco excluído' },
  { value: 'morador_created', label: 'Morador criado' },
  { value: 'morador_updated', label: 'Morador atualizado' },
  { value: 'morador_deleted', label: 'Morador excluído' },
  { value: 'setor_created', label: 'Setor criado' },
  { value: 'setor_updated', label: 'Setor atualizado' },
  { value: 'setor_deleted', label: 'Setor excluído' },
  { value: 'unidade_created', label: 'Unidade criada' },
  { value: 'unidade_updated', label: 'Unidade atualizada' },
  { value: 'unidade_deleted', label: 'Unidade excluída' },
  { value: 'user_created', label: 'Usuário criado' },
  { value: 'user_updated', label: 'Usuário atualizado' },
  { value: 'user_deleted', label: 'Usuário excluído' },
];

const ENTIDADE_TIPOS = [
  { value: '', label: 'Todas as entidades' },
  { value: 'condominio', label: 'Condomínio' },
  { value: 'user', label: 'Usuário' },
  { value: 'morador', label: 'Morador' },
  { value: 'unidade', label: 'Unidade' },
  { value: 'setor', label: 'Setor' },
  { value: 'bloco', label: 'Bloco' },
];

interface CondominioOption {
  id: string;
  nome: string;
}

interface AuditFiltersProps {
  condominios: CondominioOption[];
  baseUrl?: string;
}

export function AuditFilters({ condominios, baseUrl = '/super-admin/audit' }: AuditFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page');
      router.push(`${baseUrl}?${params.toString()}`);
    },
    [router, searchParams, baseUrl],
  );

  const selectClass =
    'rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground';
  const inputClass =
    'rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground';

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="space-y-1">
        <span className="text-xs text-text-secondary">Ação</span>
        <select
          className={selectClass}
          value={searchParams.get('acao') ?? ''}
          onChange={(e) => update('acao', e.target.value)}
        >
          {ACOES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </label>

      {condominios.length > 0 && (
        <label className="space-y-1">
          <span className="text-xs text-text-secondary">Condomínio</span>
          <select
            className={selectClass}
            value={searchParams.get('condominio_id') ?? ''}
            onChange={(e) => update('condominio_id', e.target.value)}
          >
            <option value="">Todos</option>
            {condominios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="space-y-1">
        <span className="text-xs text-text-secondary">Entidade</span>
        <select
          className={selectClass}
          value={searchParams.get('entidade_tipo') ?? ''}
          onChange={(e) => update('entidade_tipo', e.target.value)}
        >
          {ENTIDADE_TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="text-xs text-text-secondary">De</span>
        <input
          type="date"
          className={inputClass}
          value={searchParams.get('from') ?? ''}
          onChange={(e) => update('from', e.target.value)}
        />
      </label>

      <label className="space-y-1">
        <span className="text-xs text-text-secondary">Até</span>
        <input
          type="date"
          className={inputClass}
          value={searchParams.get('to') ?? ''}
          onChange={(e) => update('to', e.target.value)}
        />
      </label>

      <label className="space-y-1">
        <span className="text-xs text-text-secondary">Usuário</span>
        <input
          type="text"
          placeholder="Buscar por nome..."
          className={`${inputClass} w-40`}
          defaultValue={searchParams.get('user_q') ?? ''}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              update('user_q', (e.target as HTMLInputElement).value);
            }
          }}
          onBlur={(e) => update('user_q', e.target.value)}
        />
      </label>
    </div>
  );
}
