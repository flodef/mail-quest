"use client";

import { useEffect, useState } from "react";
import { IconArrowBackUp, IconCheck, IconChevronDown, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import DateTimeInput from "@/components/DateTimeInput";
import Sheet from "@/components/Sheet";
import { fmtWhen, startOfToday } from "@/lib/dates";
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

const selectCls =
  "bg-[var(--shadow)] border-2 border-[var(--gold)] px-2 py-1.5 text-base outline-none focus:border-[var(--gold-bright)] [color-scheme:dark]";

function AgendaRow({
  ev,
  now,
  busy,
  min,
  onDone,
  onUndone,
  onDelete,
  onUpdate,
  onSchedule,
}: {
  ev: AgendaEvent;
  now: number;
  busy: boolean;
  min: Date;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, text: string) => void;
  onSchedule: (id: string, dueAt: string, remindMinutes: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editingWhen, setEditingWhen] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftWhen, setDraftWhen] = useState<Date | null>(null);
  const [draftRemind, setDraftRemind] = useState(ev.remind_minutes);
  const past = +new Date(ev.due_at) < now;

  function save() {
    const t = draft.trim();
    if (t && t !== ev.text) onUpdate(ev.id, t);
    setEditing(false);
  }

  function saveWhen() {
    if (draftWhen && (+draftWhen !== +new Date(ev.due_at) || draftRemind !== ev.remind_minutes)) {
      onSchedule(ev.id, draftWhen.toISOString(), draftRemind);
    }
    setEditingWhen(false);
  }

  if (ev.done) {
    return (
      <div className="flex items-center gap-2 bg-[var(--shadow)] p-2.5 border border-[#3a5a2a]">
        <div className="flex-1 min-w-0">
          <div className="text-lg leading-snug break-words line-through">{ev.text}</div>
          <div className="font-pixel text-[6px] opacity-60">{fmtWhen(ev.due_at, now)}</div>
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
    <div className="flex flex-col gap-2 bg-[var(--shadow)] p-2.5 border border-[#3a5a2a]">
      <div className="flex items-center gap-2">
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
          {/* Toucher la date ouvre l'éditeur d'échéance (date + rappel). */}
          <button
            className={`font-pixel text-[6px] mt-0.5 text-left ${past ? "text-[var(--ruby)]" : "opacity-60 hover:opacity-100"}`}
            disabled={busy}
            title="Modifier la date / le rappel"
            onClick={() => {
              setDraftWhen(new Date(ev.due_at));
              setDraftRemind(ev.remind_minutes);
              setEditingWhen((v) => !v);
            }}
          >
            {fmtWhen(ev.due_at, now)} · 🔔 {remindLabel(ev.remind_minutes)} AVANT
          </button>
        </div>
        <button className="btn-pixel ghost !p-1.5 shrink-0" disabled={busy} title="Fait" onClick={() => onDone(ev.id)}>
          <IconCheck size={16} />
        </button>
        <button className="btn-pixel danger !p-1.5 shrink-0" disabled={busy} title="Jeter à la potence" onClick={() => onDelete(ev.id)}>
          <IconTrash size={16} />
        </button>
      </div>
      {editingWhen && (
        <div className="flex gap-2 items-center flex-wrap border-t border-[#3a5a2a] pt-2">
          <DateTimeInput value={draftWhen} onChange={setDraftWhen} min={min} disabled={busy} className="flex-1 min-w-[220px]" />
          <select className={selectCls} value={draftRemind} onChange={(e) => setDraftRemind(Number(e.target.value))} title="Rappel avant l'échéance">
            {REMIND_OPTIONS.map((o) => (
              <option key={o.m} value={o.m}>-{o.l}</option>
            ))}
          </select>
          <button className="btn-pixel !px-2.5 !py-1.5" disabled={busy || !draftWhen} onClick={saveWhen} title="Valider">
            <IconCheck size={16} />
          </button>
          <button className="btn-pixel ghost !px-2.5 !py-1.5" onClick={() => setEditingWhen(false)} title="Annuler">
            <IconX size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function AgendaPanel({
  events,
  busy,
  open,
  onClose,
  onAdd,
  onDone,
  onUndone,
  onDelete,
  onUpdate,
  onSchedule,
}: {
  events: AgendaEvent[];
  busy: boolean;
  open: boolean;
  onClose: () => void;
  onAdd: (text: string, dueAt: string, remindMinutes: number) => void;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, text: string) => void;
  onSchedule: (id: string, dueAt: string, remindMinutes: number) => void;
}) {
  const [text, setText] = useState("");
  const [when, setWhen] = useState<Date | null>(null);
  const [remind, setRemind] = useState(30);
  const [showDone, setShowDone] = useState(false);
  // Jour mini pour le calendrier : fixé au mount du panneau (toujours monté).
  const [min] = useState(startOfToday);
  // Horloge locale (rafraîchie toutes les 30 s, seulement quand le panneau
  // est ouvert) pour marquer les échéances passées.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [open]);

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
    <Sheet onClose={onClose}>
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
          <DateTimeInput value={when} onChange={setWhen} min={min} disabled={busy} className="flex-1 min-w-0" />
          <select
            className={`${selectCls} !py-2`}
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
          <AgendaRow key={ev.id} ev={ev} now={now} busy={busy} min={min} onDone={onDone} onUndone={onUndone} onDelete={onDelete} onUpdate={onUpdate} onSchedule={onSchedule} />
        ))}
      </div>
      {upcoming.length > 0 && (
        <div className="font-pixel text-[6px] opacity-50 text-center">TOUCHER LE TEXTE OU LA DATE POUR ÉDITER</div>
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
                <AgendaRow key={ev.id} ev={ev} now={now} busy={busy} min={min} onDone={onDone} onUndone={onUndone} onDelete={onDelete} onUpdate={onUpdate} onSchedule={onSchedule} />
              ))}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
