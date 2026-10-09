"use client";

import { useEffect, useRef, useState } from "react";
import { IconArrowBackUp, IconCheck, IconChevronDown, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import DateTimeInput from "@/components/DateTimeInput";
import type { AgendaEvent } from "@/lib/db";

export const REMIND_OPTIONS = [
  { m: 30, l: "30 min" },
  { m: 60, l: "1 h" },
  { m: 120, l: "2 h" },
  { m: 180, l: "3 h" },
  { m: 360, l: "6 h" },
  { m: 720, l: "12 h" },
  { m: 1440, l: "24 h" },
  { m: 2880, l: "48 h" },
  { m: 4320, l: "3 j" },
  { m: 7200, l: "5 j" },
  { m: 10080, l: "7 j" },
];

export function remindLabel(m: number): string {
  return REMIND_OPTIONS.find((o) => o.m === m)?.l ?? `${m} min`;
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" }) +
    " " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
}

function AgendaRow({
  ev,
  now,
  busy,
  onDone,
  onUndone,
  onDelete,
  onUpdate,
}: {
  ev: AgendaEvent;
  now: number;
  busy: boolean;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const past = +new Date(ev.due_at) < now;

  function save() {
    const t = draft.trim();
    if (t && t !== ev.text) onUpdate(ev.id, t);
    setEditing(false);
  }

  if (ev.done) {
    return (
      <div className="flex items-center gap-2 bg-[var(--shadow)] p-2.5 border border-[#3a5a2a]">
        <div className="flex-1 min-w-0">
          <div className="text-lg leading-snug break-words line-through">{ev.text}</div>
          <div className="font-pixel text-[6px] opacity-60">{fmtWhen(ev.due_at)}</div>
        </div>
        <button className="shrink-0 opacity-70 hover:opacity-100" disabled={busy} title="Remettre dans l'agenda" onClick={() => onUndone(ev.id)}>
          <IconArrowBackUp size={16} />
        </button>
        <button className="shrink-0 opacity-70 hover:opacity-100" disabled={busy} title="Jeter à la potence" onClick={() => onDelete(ev.id)}>
          <IconTrash size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-[var(--shadow)] p-2.5 border border-[#3a5a2a]">
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            className="w-full bg-black/30 border border-[var(--gold)] px-2 py-0.5 text-lg outline-none focus:border-[var(--gold-bright)]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              else if (e.key === "Escape") setEditing(false);
            }}
            onBlur={save}
          />
        ) : (
          <div
            className="text-lg leading-snug break-words cursor-text"
            onClick={() => {
              setDraft(ev.text);
              setEditing(true);
            }}
          >
            {ev.text}
          </div>
        )}
        <div className={`font-pixel text-[6px] mt-0.5 ${past ? "text-[var(--ruby)]" : "opacity-60"}`}>
          {fmtWhen(ev.due_at)}
          {past && " (PASSÉ)"} · 🔔 {remindLabel(ev.remind_minutes)} AVANT
        </div>
      </div>
      <button className="btn-pixel ghost !p-1.5 shrink-0" disabled={busy} title="Fait" onClick={() => onDone(ev.id)}>
        <IconCheck size={16} />
      </button>
      <button className="btn-pixel danger !p-1.5 shrink-0" disabled={busy} title="Jeter à la potence" onClick={() => onDelete(ev.id)}>
        <IconTrash size={16} />
      </button>
    </div>
  );
}

export default function AgendaPanel({
  events,
  busy,
  onClose,
  onAdd,
  onDone,
  onUndone,
  onDelete,
  onUpdate,
}: {
  events: AgendaEvent[];
  busy: boolean;
  onClose: () => void;
  onAdd: (text: string, dueAt: string, remindMinutes: number) => void;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, text: string) => void;
}) {
  const [text, setText] = useState("");
  const [when, setWhen] = useState<Date | null>(null);
  const [remind, setRemind] = useState(30);
  const [showDone, setShowDone] = useState(false);
  const downOnBackdrop = useRef(false);
  // Horloge locale (rafraîchie toutes les 30 s) pour marquer les échéances passées.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const upcoming = events.filter((e) => !e.done).sort((a, b) => +new Date(a.due_at) - +new Date(b.due_at));
  const done = events.filter((e) => e.done).sort((a, b) => +new Date(b.due_at) - +new Date(a.due_at));

  function submit() {
    const t = text.trim();
    if (!t || !when) return;
    onAdd(t, when.toISOString(), remind);
    setText("");
    setWhen(null);
    setRemind(30);
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
          <div className="font-pixel text-[9px] text-[var(--gold-bright)]">📅 AGENDA ({upcoming.length})</div>
          <button className="btn-pixel ghost !px-2" onClick={onClose}><IconX size={18} /></button>
        </div>

        <div className="flex flex-col gap-2">
          <input
            className="w-full bg-[var(--shadow)] border-2 border-[var(--gold)] px-3 py-2 text-lg outline-none focus:border-[var(--gold-bright)]"
            placeholder="Nouvelle échéance…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <div className="flex gap-2 items-center">
            <DateTimeInput value={when} onChange={setWhen} disabled={busy} />
            <select
              className="bg-[var(--shadow)] border-2 border-[var(--gold)] px-2 py-2 text-base outline-none focus:border-[var(--gold-bright)] [color-scheme:dark]"
              value={remind}
              onChange={(e) => setRemind(Number(e.target.value))}
              title="Rappel par mail avant l'échéance"
            >
              {REMIND_OPTIONS.map((o) => (
                <option key={o.m} value={o.m}>-{o.l}</option>
              ))}
            </select>
            <button className="btn-pixel !px-3" disabled={busy || !text.trim() || !when} onClick={submit} title="Ajouter"><IconPlus size={18} /></button>
          </div>
          <div className="font-pixel text-[6px] opacity-50">RAPPEL PAR MAIL {remindLabel(remind).toUpperCase()} AVANT</div>
        </div>

        {upcoming.length === 0 && <div className="opacity-60">Aucune échéance à venir.</div>}
        <div className="flex flex-col gap-1.5">
          {upcoming.map((ev) => (
            <AgendaRow key={ev.id} ev={ev} now={now} busy={busy} onDone={onDone} onUndone={onUndone} onDelete={onDelete} onUpdate={onUpdate} />
          ))}
        </div>
        {upcoming.length > 0 && (
          <div className="font-pixel text-[6px] opacity-50 text-center">TOUCHER UNE ÉCHÉANCE POUR ÉDITER SON TEXTE</div>
        )}

        {done.length > 0 && (
          <div className="mt-1 pt-3 border-t border-[#2a4a2a]">
            <button
              className="btn-pixel ghost w-full flex items-center justify-center gap-1.5 !py-1.5 font-pixel text-[7px]"
              onClick={() => setShowDone((s) => !s)}
            >
              <IconChevronDown size={14} className={`transition-transform ${showDone ? "rotate-180" : ""}`} />
              {done.length} PASSÉE(S)/FAITE(S)
            </button>
            {showDone && (
              <div className="flex flex-col gap-1.5 mt-2 opacity-50">
                {done.map((ev) => (
                  <AgendaRow key={ev.id} ev={ev} now={now} busy={busy} onDone={onDone} onUndone={onUndone} onDelete={onDelete} onUpdate={onUpdate} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
