"use client";

import { useRef, useState } from "react";
import { IconChevronDown, IconPlus, IconSkull, IconX } from "@tabler/icons-react";
import ItemRow from "@/components/ItemRow";
import SortableList from "@/components/SortableList";
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
  const [showReserve, setShowReserve] = useState(false);
  const active = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const visible = active.slice(0, VISIBLE);
  const reserve = active.slice(VISIBLE);
  const hidden = reserve.length;

  function submit() {
    const t = input.trim();
    if (!t) return;
    setInput("");
    onAdd(t);
  }

  function handleReorder(next: Task[]) {
    onReorder([...next.map((t) => t.id), ...reserve.map((t) => t.id)]);
  }

  function handleReserveReorder(next: Task[]) {
    onReorder([...visible.map((t) => t.id), ...next.map((t) => t.id)]);
  }

  // Promotion : la quête entre en position 5, l'ancienne n°5 glisse en 6.
  function promote(id: string) {
    onReorder([
      ...visible.slice(0, VISIBLE - 1).map((t) => t.id),
      id,
      ...visible.slice(VISIBLE - 1).map((t) => t.id),
      ...reserve.filter((t) => t.id !== id).map((t) => t.id),
    ]);
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

        <SortableList
          items={visible}
          onReorder={handleReorder}
          renderItem={(t, grip) => (
            <ItemRow item={t} grip={grip} doneLabel="⚔ QUÊTE FAITE" bottomLabel="⇣ FOND DE PILE" onDone={() => onDone(t.id)} onBottom={() => onBottom(t.id)} />
          )}
        />
        {active.length === 0 && <div className="opacity-60">Aucune quête en cours.</div>}
        {hidden > 0 && (
          <>
            <button
              className="btn-pixel ghost w-full flex items-center justify-center gap-1.5 !py-1.5 font-pixel text-[7px]"
              onClick={() => setShowReserve((s) => !s)}
            >
              <IconChevronDown size={14} className={`transition-transform ${showReserve ? "rotate-180" : ""}`} />
              {hidden} QUÊTE(S) EN RÉSERVE
            </button>
            {showReserve && (
              <SortableList
                items={reserve}
                onReorder={handleReserveReorder}
                renderItem={(t, grip) => (
                  <ItemRow
                    item={t}
                    grip={grip}
                    dim
                    onPromote={() => promote(t.id)}
                    doneLabel="⚔ QUÊTE FAITE"
                    bottomLabel="⇣ FOND DE PILE"
                    onDone={() => onDone(t.id)}
                    onBottom={() => onBottom(t.id)}
                  />
                )}
              />
            )}
          </>
        )}
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
