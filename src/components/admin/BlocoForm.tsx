'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface BlocoFormInitial {
  id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
}

interface Props {
  mode: 'create' | 'edit';
  initial?: BlocoFormInitial;
  onDone: () => void;
}

export function BlocoForm({ mode, initial, onDone }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState(initial?.nome ?? '');
  const [descricao, setDescricao] = useState(initial?.descricao ?? '');
  const [ordem, setOrdem] = useState(String(initial?.ordem ?? 0));
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      nome: nome.trim(),
      descricao: descricao.trim() || undefined,
      ordem: ordem ? Number(ordem) : 0,
    };

    try {
      const url =
        mode === 'edit' ? `/api/admin/blocos/${initial!.id}` : '/api/admin/blocos';
      const res = await fetch(url, {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? 'Falha ao salvar.');
        return;
      }

      router.refresh();
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <h2 className="text-lg font-semibold">
        {mode === 'create' ? 'Novo Bloco' : 'Editar Bloco'}
      </h2>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="bloco-nome">Nome</Label>
        <Input
          id="bloco-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Bloco A, Torre 1"
          maxLength={50}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bloco-descricao">Descricao</Label>
        <Input
          id="bloco-descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Opcional"
          maxLength={500}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bloco-ordem">Ordem</Label>
        <Input
          id="bloco-ordem"
          type="number"
          value={ordem}
          onChange={(e) => setOrdem(e.target.value)}
          min={0}
          max={9999}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Salvando...' : mode === 'create' ? 'Criar Bloco' : 'Salvar'}
      </Button>
    </form>
  );
}
