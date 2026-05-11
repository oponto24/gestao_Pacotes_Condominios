'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/**
 * Override do botão FAB central da bottom nav.
 *
 * Páginas registram uma ação contextual com `state` da state machine
 * (spec `docs/design/fab-chegada-spec.md`). Quando override é null,
 * BottomNavBar volta pro comportamento padrão (link → `/chegada`).
 */

/**
 * State do FAB central — state machine completa do fluxo Chegada.
 *
 * - `idle-route`: outra rota da portaria → link pra `/chegada`
 * - `idle-page`: em `/chegada`, câmera desligada → "Abrir câmera" (halo pulse)
 * - `streaming`: câmera ativa → "Capturar" (shutter branco)
 * - `captured`: foto pronta → "Usar foto" (gradiente verde)
 * - `submitting`: upload em andamento → spinner disabled
 */
export type FabState =
  | 'idle-route'
  | 'idle-page'
  | 'streaming'
  | 'captured'
  | 'submitting';

export interface BottomNavCenterOverride {
  /** State da máquina de estados — driver do estilo visual. */
  state: FabState;
  /** Texto exibido abaixo do ícone (curto — máx ~10 chars). Vazio em `streaming` (só shutter). */
  label: string;
  /** Ícone (lucide ou qualquer ReactNode). */
  icon: React.ReactNode;
  /** Handler. */
  onClick: () => void;
  /** Aria-label completo (default: label). */
  ariaLabel?: string;
  /** Desabilita interação (usado em `submitting`). */
  disabled?: boolean;
}

interface BottomNavContextValue {
  override: BottomNavCenterOverride | null;
  setOverride: (o: BottomNavCenterOverride | null) => void;
}

const BottomNavContext = createContext<BottomNavContextValue | null>(null);

export function BottomNavProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = useState<BottomNavCenterOverride | null>(null);
  const value = useMemo(() => ({ override, setOverride }), [override]);
  return <BottomNavContext.Provider value={value}>{children}</BottomNavContext.Provider>;
}

export function useBottomNav(): BottomNavContextValue {
  const ctx = useContext(BottomNavContext);
  if (!ctx) {
    // Defensivo: se algum componente fora do provider tentar ler, retorna no-op
    // pra não quebrar render. (BottomNavBar tem seu próprio fallback.)
    return { override: null, setOverride: () => undefined };
  }
  return ctx;
}

/**
 * Hook conveniente: registra override enquanto montado, limpa no unmount.
 *
 * Uso:
 *   useBottomNavOverride(
 *     state.kind === 'captured'
 *       ? { state: 'captured', label: 'Usar foto', icon: <Check />, onClick: handleConfirm }
 *       : null
 *   );
 */
export function useBottomNavOverride(
  override: BottomNavCenterOverride | null,
): void {
  const { setOverride } = useBottomNav();
  // Memoize as fields individually pra evitar setState em cada render quando
  // o objeto é literal inline mas valores são iguais.
  const state = override?.state;
  const label = override?.label;
  const icon = override?.icon;
  const onClick = override?.onClick;
  const ariaLabel = override?.ariaLabel;
  const disabled = override?.disabled;

  const stableOverride = useMemo<BottomNavCenterOverride | null>(() => {
    if (!state || !label || !icon || !onClick) return null;
    return { state, label, icon, onClick, ariaLabel, disabled };
  }, [state, label, icon, onClick, ariaLabel, disabled]);

  const apply = useCallback(() => {
    setOverride(stableOverride);
  }, [setOverride, stableOverride]);

  useEffect(() => {
    apply();
    return () => setOverride(null);
  }, [apply, setOverride]);
}
