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
 * Páginas podem registrar uma ação contextual que substitui temporariamente
 * o link `/chegada` enquanto a action faz sentido (ex: na tela de captura,
 * após tirar a foto, FAB vira "Usar foto" e dispara confirm).
 *
 * Quando override é null, BottomNavBar volta ao comportamento padrão (link).
 */

export interface BottomNavCenterOverride {
  /** Texto exibido abaixo do ícone (curto — máx ~10 chars). */
  label: string;
  /** Ícone (lucide ou qualquer ReactNode). */
  icon: React.ReactNode;
  /** Handler. */
  onClick: () => void;
  /** Aria-label completo (default: label). */
  ariaLabel?: string;
  /** Variante visual — default: igual ao FAB Chegada (amarelo). */
  variant?: 'default' | 'success';
  /** Desabilita interação (mostra spinner via parent). */
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
 *       ? { label: 'Usar foto', icon: <Check />, onClick: handleConfirm }
 *       : null
 *   );
 */
export function useBottomNavOverride(
  override: BottomNavCenterOverride | null,
): void {
  const { setOverride } = useBottomNav();
  // Memoize as fields individually pra evitar setState em cada render quando
  // o objeto é literal inline mas valores são iguais.
  const label = override?.label;
  const icon = override?.icon;
  const onClick = override?.onClick;
  const ariaLabel = override?.ariaLabel;
  const variant = override?.variant;
  const disabled = override?.disabled;

  const stableOverride = useMemo<BottomNavCenterOverride | null>(() => {
    if (!label || !icon || !onClick) return null;
    return { label, icon, onClick, ariaLabel, variant, disabled };
  }, [label, icon, onClick, ariaLabel, variant, disabled]);

  const apply = useCallback(() => {
    setOverride(stableOverride);
  }, [setOverride, stableOverride]);

  useEffect(() => {
    apply();
    return () => setOverride(null);
  }, [apply, setOverride]);
}
