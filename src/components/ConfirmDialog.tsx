"use client";

// Modale de confirmation (destructif) — style parchemin sombre.
export default function ConfirmDialog({
  label,
  onConfirm,
  onCancel,
}: {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="panel max-w-sm w-full p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="font-pixel text-[9px] text-[var(--ruby)]">⚠ ATTENTION, VOYAGEUR</div>
        <div className="text-lg leading-snug">{label}</div>
        <div className="flex gap-3">
          <button className="btn-pixel ghost flex-1" onClick={onCancel}>Non</button>
          <button className="btn-pixel danger flex-1" onClick={onConfirm}>Oui</button>
        </div>
      </div>
    </div>
  );
}
