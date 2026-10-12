"use client";

import { IconRefresh } from "@tabler/icons-react";

/** Bouton refresh partagé des panneaux — à côté du ✕ de chaque Sheet. */
export default function RefreshButton({ onClick, spinning, disabled }: { onClick: () => void; spinning?: boolean; disabled?: boolean }) {
  return (
    <button className="btn-pixel ghost !px-2" onClick={onClick} title="Rafraîchir" disabled={disabled}>
      <IconRefresh size={18} className={spinning ? "animate-spin" : ""} />
    </button>
  );
}
