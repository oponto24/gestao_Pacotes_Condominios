'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, User, Home, Package, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface SearchResult {
  type: 'morador' | 'unidade' | 'pacote';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const TYPE_CONFIG = {
  morador: { icon: User, label: 'Morador', color: 'text-blue-600' },
  unidade: { icon: Home, label: 'Unidade', color: 'text-green-600' },
  pacote: { icon: Package, label: 'Pacote', color: 'text-orange-600' },
} as const;

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
      }
    } catch {
      // Silently fail — user will see empty state
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInputChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  }

  function handleSelect(result: SearchResult) {
    setOpen(false);
    router.push(result.href);
  }

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-primary-light/20 hover:text-foreground"
      >
        <Search className="h-4 w-4" aria-hidden />
        <span className="hidden md:inline">Buscar...</span>
        <kbd className="hidden rounded border border-border bg-background px-1.5 py-0.5 text-xs font-mono text-text-secondary md:inline-block">
          Cmd+K
        </kbd>
        <span className="md:hidden sr-only">Buscar</span>
      </button>

      {/* Search dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">Busca global</DialogTitle>

          {/* Search input */}
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Buscar moradores, unidades, pacotes..."
              className="border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-text-secondary"
            />
            {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-text-secondary" />}
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto p-2">
            {query.trim().length >= 2 && !loading && results.length === 0 && (
              <div className="py-8 text-center text-sm text-text-secondary">
                Nenhum resultado
              </div>
            )}

            {results.length > 0 && (
              <ul className="space-y-0.5" role="listbox">
                {results.map((result) => {
                  const config = TYPE_CONFIG[result.type];
                  const Icon = config.icon;
                  return (
                    <li key={`${result.type}-${result.id}`}>
                      <button
                        type="button"
                        onClick={() => handleSelect(result)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-primary-light/20"
                        role="option"
                        aria-selected={false}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${config.color}`} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">
                            {result.title}
                          </div>
                          <div className="truncate text-xs text-text-secondary">
                            {result.subtitle}
                          </div>
                        </div>
                        <Badge variant="muted" className="shrink-0 text-xs">
                          {config.label}
                        </Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {query.trim().length < 2 && results.length === 0 && !loading && (
              <div className="py-8 text-center text-sm text-text-secondary">
                Digite ao menos 2 caracteres para buscar
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
