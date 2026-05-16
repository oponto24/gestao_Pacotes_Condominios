'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

interface UserData {
  id: string;
  nome: string;
  email: string;
  role: string;
}

interface Props {
  user: UserData;
  onDone: () => void;
}

export function UserEditForm({ user, onDone }: Props) {
  const router = useRouter();
  const [nome, setNome] = useState(user.nome);
  const [role, setRole] = useState(user.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const changes: Record<string, string> = {};
    if (nome.trim() !== user.nome) changes.nome = nome.trim();
    if (role !== user.role) changes.role = role;

    if (Object.keys(changes).length === 0) {
      onDone();
      return;
    }

    const res = await fetch(`/api/super-admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? 'Falha ao salvar');
      setSaving(false);
      return;
    }

    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-1">
      <h2 className="text-lg font-semibold">Editar usuário</h2>
      <p className="text-sm text-text-secondary">{user.email}</p>

      <div className="space-y-2">
        <Label htmlFor="edit-nome">Nome</Label>
        <Input
          id="edit-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          minLength={1}
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-role">Role</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger id="edit-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin_master">Admin Master</SelectItem>
            <SelectItem value="admin_funcionario">Admin Funcionário</SelectItem>
            <SelectItem value="porteiro">Porteiro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
