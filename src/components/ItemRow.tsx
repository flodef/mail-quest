"use client";

import { motion, useMotionValue, useMotionValueEvent, useTransform, type PanInfo } from "framer-motion";
import { useRef, useState } from "react";
import { IconCheck, IconGripVertical } from "@tabler/icons-react";
import type { GripProps } from "@/components/SortableList";

export const SWIPE_X = 90;

export default function ItemRow<T>({
  item,
  grip,
  onDone,
  onBottom,
  onEdit,
  dim = false,
  doneLabel = "⚔ FAIT",
  bottomLabel = "⇣ FOND",
}: {
  item: T;
  grip: GripProps;
  onDone: () => void;
  onBottom: () => void;
  onEdit?: (text: string) => void;
  dim?: boolean;
  doneLabel?: string;
  bottomLabel?: string;
}) {
  const x = useMotionValue(0);
  const doneOpacity = useTransform(x, [20, SWIPE_X], [0, 1]);
  const bottomOpacity = useTransform(x, [-SWIPE_X, -20], [1, 0]);
  // Un swipe relâché au point de départ produit un click : on mémorise tout
  // déplacement >10px pour l'ignorer (vrai tap = pas de drag).
  const dragged = useRef(false);
  useMotionValueEvent(x, "change", (v) => {
    if (Math.abs(v) > 10) dragged.current = true;
  });
  const text = (item as { text?: string }).text ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_X) onDone();
    else if (info.offset.x < -SWIPE_X) onBottom();
  }

  function saveEdit() {
    const t = draft.trim();
    if (t && t !== text) onEdit?.(t);
    setEditing(false);
  }

  return (
    <div className="relative">
      <motion.div
        className="absolute top-1.5 left-1.5 font-pixel text-[8px] px-1.5 py-0.5 border-2 border-[var(--link-green)] text-[var(--link-green)] bg-[#e8ffe8] pointer-events-none z-10"
        style={{ opacity: doneOpacity }}
      >
        {doneLabel}
      </motion.div>
      <motion.div
        className="absolute top-1.5 right-1.5 font-pixel text-[8px] px-1.5 py-0.5 border-2 border-[var(--gold-bright)] text-[var(--gold-bright)] bg-[#fff8dc] pointer-events-none z-10"
        style={{ opacity: bottomOpacity }}
      >
        {bottomLabel}
      </motion.div>
      {/* Poignée HORS de la zone swipe : glisser ☰ horizontalement ne doit
          jamais déclencher l'action gauche/droite (framer capte le pointeur
          en natif avant le stopPropagation de React). */}
      <button
        {...grip}
        className="absolute left-0 top-0 bottom-0 w-6 z-20 flex items-center justify-center opacity-50 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Réordonner"
      >
        <IconGripVertical size={16} />
      </button>
      <motion.div
        drag={editing ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDragEnd={onDragEnd}
        style={{ x }}
        className={`flex items-center gap-2 bg-[var(--shadow)] py-2.5 pr-2.5 pl-7 border border-[#3a5a2a] select-none${dim ? " opacity-60" : ""}`}
      >
        {editing ? (
          <>
            <input
              autoFocus
              className="flex-1 min-w-0 bg-black/30 border border-[var(--gold)] px-2 py-0.5 text-lg outline-none focus:border-[var(--gold-bright)]"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                else if (e.key === "Escape") setEditing(false);
              }}
              onBlur={saveEdit}
            />
            <button className="shrink-0 opacity-70 hover:opacity-100" title="Valider" onClick={saveEdit}>
              <IconCheck size={18} />
            </button>
          </>
        ) : (
          <div
            className={`flex-1 min-w-0 text-lg leading-snug break-words${onEdit ? " cursor-text" : ""}`}
            onPointerDown={() => (dragged.current = false)}
            onClick={() => {
              if (dragged.current || !onEdit) return;
              setDraft(text);
              setEditing(true);
            }}
          >
            {text}
          </div>
        )}
      </motion.div>
    </div>
  );
}
