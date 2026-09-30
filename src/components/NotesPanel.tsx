"use client";

import { useMemo, useRef, useState } from "react";
import { Reorder } from "framer-motion";
import { IconArrowLeft, IconPlus, IconSkull, IconTrash, IconX } from "@tabler/icons-react";
import ItemRow from "@/components/ItemRow";
import { parseNoteItems, serializeNoteItems, type NoteItem } from "@/lib/items";
import type { Note } from "@/lib/db";

type Item = NoteItem & { id: string };

function parseItems(body: string): Item[] {
  return parseNoteItems(body).map((i, n) => ({ ...i, id: `i${n}` }));
}

function fmtNoteDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function NoteDetail({
  note,
  busy,
  onBack,
  onUpdate,
  onDelete,
}: {
  note: Note;
  busy: boolean;
  onBack: () => void;
  onUpdate: (id: string, body: string) => void;
  onDelete: (id: string) => void;
}) {
  const items = useMemo(() => parseItems(note.body), [note.body]);
  const [input, setInput] = useState("");
  const idCounter = useRef(0);

  const active = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  function save(next: Item[]) {
    onUpdate(note.id, serializeNoteItems(next));
  }

  function submit() {
    const t = input.trim();
    if (!t) return;
    setInput("");
    save([...active, { id: `n${++idCounter.current}`, text: t, done: false }, ...done]);
  }

  function itemDone(id: string) {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    save([...active.filter((i) => i.id !== id), ...done, { ...it, done: true }]);
  }

  function itemBottom(id: string) {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    save([...active.filter((i) => i.id !== id), it, ...done]);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <button className="btn-pixel ghost !px-2" onClick={onBack} title="Retour"><IconArrowLeft size={18} /></button>
        <div className="font-pixel text-[8px] text-[var(--gold-bright)] flex-1 min-w-0 break-words">{note.title}</div>
        <button className="shrink-0 opacity-50 hover:opacity-100" disabled={busy} onClick={() => onDelete(note.id)} title="Jeter la note"><IconTrash size={16} /></button>
      </div>
      <div className="font-pixel text-[6px] opacity-50">{fmtNoteDate(note.created_at)}</div>

      <div className="flex gap-2">
        <input
          className="flex-1 min-w-0 bg-[var(--shadow)] border-2 border-[var(--gold)] px-3 py-2 text-lg outline-none focus:border-[var(--gold-bright)]"
          placeholder="Ajouter un item…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="btn-pixel !px-3" disabled={busy || !input.trim()} onClick={submit}><IconPlus size={18} /></button>
      </div>

      <Reorder.Group axis="y" values={active} onReorder={(next: Item[]) => save([...next, ...done])} className="flex flex-col gap-2">
        {active.map((i) => (
          <ItemRow key={i.id} item={i} onDone={() => itemDone(i.id)} onBottom={() => itemBottom(i.id)} />
        ))}
      </Reorder.Group>
      {active.length === 0 && items.length === 0 && <div className="opacity-60">Note vide.</div>}
      {active.length === 0 && items.length > 0 && <div className="opacity-60">Tout est fait ✅</div>}
      <div className="font-pixel text-[6px] opacity-50 text-center">◀ FOND DE PILE · GLISSER ☰ POUR RÉORDONNER · FAIT ▶</div>

      {done.length > 0 && (
        <>
          <div className="flex items-center justify-between mt-1">
            <div className="font-pixel text-[8px] opacity-70">FAITS ({done.length})</div>
            <button className="btn-pixel danger !py-1.5 !px-2 text-[8px] flex items-center gap-1" disabled={busy} onClick={() => save(active)}>
              <IconSkull size={14} /> Purger
            </button>
          </div>
          <div className="flex flex-col gap-1.5 opacity-50">
            {done.map((i) => (
              <div key={i.id} className="bg-[var(--shadow)] p-2 border border-[#3a5a2a] text-base line-through">{i.text}</div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function NotesPanel({
  notes,
  busy,
  onClose,
  onAdd,
  onDelete,
  onUpdate,
}: {
  notes: Note[];
  busy: boolean;
  onClose: () => void;
  onAdd: (body: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, body: string) => void;
}) {
  const [input, setInput] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const downOnBackdrop = useRef(false);
  const open = notes.find((n) => n.id === openId) ?? null;

  function submit() {
    const t = input.trim();
    if (!t) return;
    setInput("");
    onAdd(t);
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
          <div className="font-pixel text-[9px] text-[var(--gold-bright)]">📒 FOURRE-TOUT ({notes.length})</div>
          <button className="btn-pixel ghost !px-2" onClick={onClose}><IconX size={18} /></button>
        </div>

        {open ? (
          <NoteDetail
            note={open}
            busy={busy}
            onBack={() => setOpenId(null)}
            onUpdate={onUpdate}
            onDelete={(id) => { setOpenId(null); onDelete(id); }}
          />
        ) : (
          <>
            <div className="flex gap-2">
              <textarea
                className="flex-1 min-w-0 resize-none bg-[var(--shadow)] border-2 border-[var(--gold)] px-3 py-2 text-lg outline-none focus:border-[var(--gold-bright)]"
                placeholder="Note rapide… (1 ligne = 1 item)"
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button className="btn-pixel !px-3 self-end" disabled={busy || !input.trim()} onClick={submit}><IconPlus size={18} /></button>
            </div>

            {notes.length === 0 && <div className="opacity-60">Le fourre-tout est vide.</div>}
            {notes.map((n) => (
              <button key={n.id} className="bg-[var(--shadow)] p-3 border border-[#3a5a2a] flex flex-col gap-1.5 text-left w-full cursor-pointer" onClick={() => setOpenId(n.id)}>
                <div className="font-pixel text-[8px] text-[var(--gold-bright)] min-w-0 break-words">{n.title}</div>
                <div className="text-base leading-snug whitespace-pre-wrap break-words line-clamp-3">{n.body}</div>
                <div className="font-pixel text-[6px] opacity-50">{fmtNoteDate(n.created_at)}</div>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
