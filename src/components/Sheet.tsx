"use client";

import { useRef, type ReactNode } from "react";

/**
 * Fermeture au clic sur le backdrop, honorée seulement si le press a
 * commencé dessus — un swipe/drag relâché hors du panneau produit sinon un
 * click backdrop qui fermerait l'overlay par accident.
 */
export function useBackdropClose(onClose: () => void) {
  const down = useRef(false);
  return {
    onPointerDown: (e: React.PointerEvent) => (down.current = e.target === e.currentTarget),
    onClick: (e: React.MouseEvent) => {
      if (down.current && e.target === e.currentTarget) onClose();
    },
  };
}

/** Bottom-sheet partagé : backdrop + panneau parchemin sombre.
    `panelClass` remplace la classe max-h par défaut (max-h-[80dvh]) —
    deux max-h concurrentes ne se résolvent pas par ordre d'attributs. */
export default function Sheet({
  onClose,
  children,
  panelClass = "max-h-[80dvh]",
  onPanelClick,
}: {
  onClose: () => void;
  children: ReactNode;
  panelClass?: string;
  onPanelClick?: () => void;
}) {
  const backdrop = useBackdropClose(onClose);
  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-end" {...backdrop}>
      <div
        className={`panel w-full max-w-md mx-auto p-4 overflow-y-auto flex flex-col gap-3 ${panelClass}`}
        onClick={(e) => {
          e.stopPropagation();
          onPanelClick?.();
        }}
      >
        {children}
      </div>
    </div>
  );
}
