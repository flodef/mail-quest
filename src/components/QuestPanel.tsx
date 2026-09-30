"use client";

import { useState } from "react";
import { Reorder, motion, useMotionValue, useTransform, useDragControls, type PanInfo } from "framer-motion";
import { IconGripVertical, IconPlus, IconSkull, IconX } from "@tabler/icons-react";
import type { Task } from "@/lib/db";

const SWIPE_X = 90;
const VISIBLE = 5;

function QuestRow({
  task,
  onDone,
  onBottom,
}: {
  task: Task;
  onDone: () => void;
  onBottom: () => void;
}) {
  const controls = useDragControls();
  const x = useMotionValue(0);
  const doneOpacity = useTransform(x, [20, SWIPE_X], [0, 1]);
  const bottomOpacity = useTransform(x, [-SWIPE_X, -20], [1, 0]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_X) onDone();
    else if (info.offset.x < -SWIPE_X) onBottom();
  }

  return (
    <Reorder.Item value={task} dragListener={false} dragControls={controls} className="relative">
      <motion.div
        className="absolute top-1.5 left-1.5 font-pixel text-[8px] px-1.5 py-0.5 border-2 border-[var(--link-green)] text-[var(--link-green)] bg-[#e8ffe8] pointer-events-none z-10"
        style={{ opacity: doneOpacity }}
      >
        ⚔ QUÊTE FAITE
      </motion.div>
      <motion.div
        className="absolute top-1.5 right-1.5 font-pixel text-[8px] px-1.5 py-0.5 border-2 border-[var(--gold-bright)] text-[var(--gold-bright)] bg-[#fff8dc] pointer-events-none z-10"
        style={{ opacity: bottomOpacity }}
      >
        ⇣ FOND DE PILE
      </motion.div>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDragEnd={onDragEnd}
        style={{ x }}
        className="flex items-center gap-2 bg-[var(--shadow)] p-2.5 border border-[#3a5a2a] select-none"
      >
        <button
          className="shrink-0 opacity-50 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={(e) => controls.start(e)}
          aria-label="Réordonner"
        >
          <IconGripVertical size={18} />
        </button>
        <div className="flex-1 min-w-0 text-lg leading-snug break-words">{task.text}</div>
      </motion.div>
    </Reorder.Item>
  );
}

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
    <div className="fixed inset-0 z-40 bg-black/70 flex items-end" onClick={onClose}>
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
            <QuestRow key={t.id} task={t} onDone={() => onDone(t.id)} onBottom={() => onBottom(t.id)} />
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
