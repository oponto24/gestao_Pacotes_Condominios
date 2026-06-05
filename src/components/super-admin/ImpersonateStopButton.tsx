'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2 } from 'lucide-react';

export function ImpersonateStopButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStop() {
    setLoading(true);
    try {
      await fetch('/api/super-admin/impersonate/stop', { method: 'POST' });
      window.location.href = '/super-admin/condominios';
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleStop}
      disabled={loading}
      className="inline-flex items-center gap-1 rounded-md bg-warning/20 px-2 py-1 text-xs font-medium text-warning-foreground hover:bg-warning/30 disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : (
        <LogOut className="size-3" aria-hidden />
      )}
      Sair
    </button>
  );
}
