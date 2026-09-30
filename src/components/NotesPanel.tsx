"use client";

import { useState } from "react";
import { IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import type { Note } from "@/lib/db";

function fmtNoteDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function NotesPanel({
  notes,
  busy,
  onClose,
  onAdd,
  onDelete,
}: {
  notes: Note[];
  busy: boolean;
  onClose: () => void;
  onAdd: (body: string) => void;
  onDelete: (id: string) => void;
}) {
  const [input, setInput] = useState("");

  function submit() {
    const t = input.trim();
    if (!t) return;
    setInput("");
    onAdd(t);
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-end" onClick={onClose}>
      <div className="panel w-full max-w-md mx-auto p-4 max-h-[80dvh] overflow-y-auto flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-pixel text-[9px] text-[var(--gold-bright)]">📒 FOURRE-TOUT ({notes.length})</div>
          <button className="btn-pixel ghost !px-2" onClick={onClose}><IconX size={18} /></button>
        </div>

        <div className="flex gap-2">
          <textarea
            className="flex-1 min-w-0 resize-none bg-[var(--shadow)] border-2 border-[var(--gold)] px-3 py-2 text-lg outline-none focus:border-[var(--gold-bright)]"
            placeholder="Note rapide…"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="btn-pixel !px-3 self-end" disabled={busy || !input.trim()} onClick={submit}><IconPlus size={18} /></button>
        </div>

        {notes.length === 0 && <div className="opacity-60">Le fourre-tout est vide.</div>}
        {notes.map((n) => (
          <div key={n.id} className="bg-[var(--shadow)] p-3 border border-[#3a5a2a] flex flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="font-pixel text-[8px] text-[var(--gold-bright)] min-w-0 break-words">{n.title}</div>
              <button className="shrink-0 opacity-50 hover:opacity-100" disabled={busy} onClick={() => onDelete(n.id)} title="Jeter la note"><IconTrash size={16} /></button>
            </div>
            <div className="text-base leading-snug whitespace-pre-wrap break-words">{n.body}</div>
            <div className="font-pixel text-[6px] opacity-50">{fmtNoteDate(n.created_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
