"use client";

import { useState } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";

export interface Draft {
  account: string;
  mailbox: string;
  uid: number;
  to: string;
  subject: string;
  date: string | null;
  preview: string;
}

const SWIPE_X = 110;

export default function DraftCard({
  draft,
  accountColor,
  onSend,
  onAside,
  onExpand,
  onReadOriginal,
  zIndex,
}: {
  draft: Draft;
  accountColor: string;
  onSend: () => void;
  onAside: () => void;
  onExpand: () => void;
  onReadOriginal: () => void;
  zIndex: number;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const sendOpacity = useTransform(x, [30, SWIPE_X], [0, 1]);
  const asideOpacity = useTransform(x, [-SWIPE_X, -30], [1, 0]);
  const [dragging, setDragging] = useState(false);

  function onDragEnd(_: unknown, info: PanInfo) {
    setDragging(false);
    if (info.offset.x > SWIPE_X) onSend();
    else if (info.offset.x < -SWIPE_X) onAside();
  }

  return (
    <motion.div
      className="absolute inset-x-0 top-0"
      style={{ x, rotate, zIndex }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragStart={() => setDragging(true)}
      onDragEnd={onDragEnd}
      whileTap={{ scale: 1.01 }}
    >
      <div className="card-parchment p-5 min-h-[300px] flex flex-col gap-4 select-none">
        <motion.div
          className="absolute top-3 left-3 font-pixel text-[9px] px-2 py-1 border-2 border-[var(--link-green)] text-[var(--link-green)] bg-[#e8ffe8]"
          style={{ opacity: sendOpacity }}
        >
          ⚔ ENVOYER
        </motion.div>
        <motion.div
          className="absolute top-3 right-3 font-pixel text-[9px] px-2 py-1 border-2 border-[var(--ruby)] text-[var(--ruby)] bg-[#ffe8ec]"
          style={{ opacity: asideOpacity }}
        >
          🏺 DE CÔTÉ
        </motion.div>

        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-[2px]" style={{ background: accountColor }} />
          <span className="font-pixel text-[8px] uppercase text-[#8a6d3b]">{draft.account}</span>
        </div>

        <div>
          <div className="font-pixel text-[8px] text-[#8a6d3b] mb-1">À :</div>
          <div className="text-xl leading-tight break-words">{draft.to || "—"}</div>
        </div>

        <div>
          <div className="font-pixel text-[8px] text-[#8a6d3b] mb-1">SUJET :</div>
          <div className="text-2xl leading-tight font-bold">{draft.subject}</div>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); if (!dragging) onExpand(); }}
          className="text-left text-lg leading-snug opacity-80 line-clamp-4"
          title="Voir le draft complet"
        >
          {draft.preview || "Voir le draft →"}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); if (!dragging) onReadOriginal(); }}
          className="mt-auto self-start font-pixel text-[8px] underline text-[#8a6d3b]"
        >
          LIRE LE PARCHEMIN →
        </button>
      </div>
    </motion.div>
  );
}
