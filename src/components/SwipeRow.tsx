"use client";

import { motion, useMotionValue, useMotionValueEvent, useTransform, type PanInfo } from "framer-motion";
import type { ReactNode, RefObject } from "react";

export const SWIPE_X = 90;

/** Ligne à balayer : ▶ droite = action "positive" (faite/remettre), ◀ gauche
    = action "destructive" (fond/potence/purge). `swipedRef` mémorise tout
    déplacement >10px pour que les onClick internes ignorent le click fantôme
    d'un swipe relâché (remettre à false au pointerdown du contenu cliquable). */
export default function SwipeRow({
  onRight,
  onLeft,
  rightLabel,
  leftLabel,
  dim = false,
  disabled = false,
  swipedRef,
  contentClassName = "",
  children,
}: {
  onRight: () => void;
  onLeft: () => void;
  rightLabel: string;
  leftLabel: string;
  dim?: boolean;
  disabled?: boolean;
  swipedRef?: RefObject<boolean>;
  contentClassName?: string;
  children: ReactNode;
}) {
  const x = useMotionValue(0);
  const rightOpacity = useTransform(x, [20, SWIPE_X], [0, 1]);
  const leftOpacity = useTransform(x, [-SWIPE_X, -20], [1, 0]);
  useMotionValueEvent(x, "change", (v) => {
    if (Math.abs(v) > 10 && swipedRef) swipedRef.current = true;
  });

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_X) onRight();
    else if (info.offset.x < -SWIPE_X) onLeft();
  }

  return (
    <div className="relative">
      <motion.div
        className="absolute top-1.5 left-1.5 font-pixel text-[8px] px-1.5 py-0.5 border-2 border-[var(--link-green)] text-[var(--link-green)] bg-[#e8ffe8] pointer-events-none z-10"
        style={{ opacity: rightOpacity }}
      >
        {rightLabel}
      </motion.div>
      <motion.div
        className="absolute top-1.5 right-1.5 font-pixel text-[8px] px-1.5 py-0.5 border-2 border-[var(--gold-bright)] text-[var(--gold-bright)] bg-[#fff8dc] pointer-events-none z-10"
        style={{ opacity: leftOpacity }}
      >
        {leftLabel}
      </motion.div>
      <motion.div
        drag={disabled ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDragEnd={onDragEnd}
        style={{ x }}
        className={`${contentClassName}${dim ? " opacity-60" : ""}`}
      >
        {children}
      </motion.div>
    </div>
  );
}
