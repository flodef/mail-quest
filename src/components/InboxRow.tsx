"use client";

import { motion, useMotionValue, useMotionValueEvent, useTransform, type PanInfo } from "framer-motion";
import { useRef } from "react";
import { IconDotsVertical, IconGripVertical, IconWand, IconTrash } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { GripProps } from "@/components/SortableList";

const SWIPE_X = 90;

export function fmtDate(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const now = new Date();
  const sameDay = dt.toDateString() === now.toDateString();
  const hm = dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? hm : `${dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} ${hm}`;
}

export default function InboxRow({
  grip,
  onOpen,
  onToggleMenu,
  onGenerate,
  onDelete,
  disabled,
  children,
}: {
  grip?: GripProps;
  onOpen: () => void;
  onToggleMenu: () => void;
  onGenerate: () => void;
  onDelete: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  const x = useMotionValue(0);
  // Un swipe suivi d'un relâchement au point de départ produit un click :
  // on mémorise tout déplacement >10px pour l'ignorer (vrai tap = pas de drag).
  const dragged = useRef(false);
  useMotionValueEvent(x, "change", (v) => {
    if (Math.abs(v) > 10) dragged.current = true;
  });
  const genOpacity = useTransform(x, [25, SWIPE_X], [0, 1]);
  const delOpacity = useTransform(x, [-SWIPE_X, -25], [1, 0]);
  const rowBg = useTransform(x, [-SWIPE_X, 0, SWIPE_X], ["#3d1220", "transparent", "#123d20"]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_X) onGenerate();
    else if (info.offset.x < -SWIPE_X) onDelete();
  }

  return (
    <motion.div
      className="relative border-b border-[#2a4a2a] select-none"
      style={{ x, backgroundColor: rowBg }}
      drag={disabled ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={onDragEnd}
    >
      <motion.div className="absolute inset-y-0 left-0 w-full flex items-center pl-3 font-pixel text-[8px] text-[#7fe08a]" style={{ opacity: genOpacity }}>
        <IconWand size={18} className="mr-1" /> FORGER
      </motion.div>
      <motion.div className="absolute inset-y-0 right-0 w-full flex items-center justify-end pr-3 font-pixel text-[8px] text-[#ff8ba0]" style={{ opacity: delOpacity }}>
        POTENCE <IconTrash size={18} className="ml-1" />
      </motion.div>
      <div className="relative py-3">
        {grip && (
          <button
            {...grip}
            className="absolute left-0 top-3.5 z-10 opacity-50 cursor-grab active:cursor-grabbing touch-none"
            aria-label="Réordonner"
          >
            <IconGripVertical size={16} />
          </button>
        )}
        <button
          className={`w-full text-left ${grip ? "pl-6" : ""}`}
          disabled={disabled}
          onPointerDown={() => (dragged.current = false)}
          onClick={() => {
            if (dragged.current) { dragged.current = false; return; }
            onOpen();
          }}
        >
          {children}
        </button>
        <button
          className="absolute right-0 top-3 btn-pixel ghost !px-1.5 !py-1"
          onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
        >
          <IconDotsVertical size={18} />
        </button>
      </div>
    </motion.div>
  );
}
