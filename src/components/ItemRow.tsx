"use client";

import { Reorder, motion, useMotionValue, useTransform, useDragControls, type PanInfo } from "framer-motion";
import { IconGripVertical } from "@tabler/icons-react";

export const SWIPE_X = 90;

export default function ItemRow<T>({
  item,
  onDone,
  onBottom,
  doneLabel = "⚔ FAIT",
  bottomLabel = "⇣ FOND",
}: {
  item: T;
  onDone: () => void;
  onBottom: () => void;
  doneLabel?: string;
  bottomLabel?: string;
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
    <Reorder.Item value={item} dragListener={false} dragControls={controls} className="relative">
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
        <div className="flex-1 min-w-0 text-lg leading-snug break-words">{(item as { text?: string }).text}</div>
      </motion.div>
    </Reorder.Item>
  );
}
