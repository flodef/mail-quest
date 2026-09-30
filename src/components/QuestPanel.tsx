"use client";

import { useRef, useState } from "react";
import { Reorder } from "framer-motion";
import { IconPlus, IconSkull, IconX } from "@tabler/icons-react";
import ItemRow from "@/components/ItemRow";
import type { Task } from "@/lib/db";

const VISIBLE = 5;

export default function QuestPanel({
  tasks,
  busy,
  onClose,
  onAdd,
  onDone,
  onBottom,
  onReorder,
  onPurge,
}: {
  tasks: Task[];
  busy: boolean;
  onClose: () => void;
  onAdd: (text: string) => void;
  onDone: (id: string) => void;
  onBottom: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onPurge: () => void;
}) {
  const [input, setInput] = useState("");
  // Un swipe de ligne relâché hors du panneau produit un click sur le backdrop
  // — ne fermer que si le press a aussi commencé sur le backdrop.
  const downOnBackdrop = useRef(false);
  const active = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const visible = active.slice(0, VISIBLE);
  const hidden = active.length - visible.length;

  function submit() {
    const t = input.trim();
    if (!t) return;
    setInput("");
    onAdd(t);
  }

  function handleReorder(next: Task[]) {
    onReorder([...next.map((t) => t.id), ...active.slice(VISIBLE).map((t) => t.id)]);
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/70 flex items-end"
      onPointerDown={(e) => (downOnBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (downOnBackdrop.current && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel w-full max-w-md mx-auto p-4 max-h-[80dvh] overflow-y-auto flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-pixel text-[9px] text-[var(--gold-bright)]">⚔ QUÊTES ({active.length})</div>
          <button className="btn-pixel ghost !px-2" onClick={onClose}><IconX size={18} /></button>
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 min-w-0 bg-[var(--shadow)] border-2 border-[var(--gold)] px-3 py-2 text-lg outline-none focus:border-[var(--gold-bright)]"
            placeholder="Nouvelle quête…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <button className="btn-pixel !px-3" disabled={busy || !input.trim()} onClick={submit}><IconPlus size={18} /></button>
        </div>

        <Reorder.Group axis="y" values={visible} onReorder={handleReorder} className="flex flex-col gap-2">
          {visible.map((t) => (
            <ItemRow key={t.id} item={t} doneLabel="⚔ QUÊTE FAITE" bottomLabel="⇣ FOND DE PILE" onDone={() => onDone(t.id)} onBottom={() => onBottom(t.id)} />
          ))}
        </Reorder.Group>
        {active.length === 0 && <div className="opacity-60">Aucune quête en cours.</div>}
        {hidden > 0 && <div className="font-pixel text-[7px] opacity-60 text-center">+ {hidden} QUÊTE(S) EN RÉSERVE — TERMINE OU REPOUSSE POUR LES FAIRE MONTER</div>}
        <div className="font-pixel text-[6px] opacity-50 text-center">◀ FOND DE PILE · GLISSER ☰ POUR RÉORDONNER · QUÊTE FAITE ▶</div>

        {done.length > 0 && (
          <>
            <div className="flex items-center justify-between mt-1">
              <div className="font-pixel text-[8px] opacity-70">TROPHÉES ({done.length})</div>
              <button className="btn-pixel danger !py-1.5 !px-2 text-[8px] flex items-center gap-1" disabled={busy} onClick={onPurge}>
                <IconSkull size={14} /> Purger
              </button>
            </div>
            <div className="flex flex-col gap-1.5 opacity-50">
              {done.map((t) => (
                <div key={t.id} className="bg-[var(--shadow)] p-2 border border-[#3a5a2a] text-base line-through">{t.text}</div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
