"use client";

import { motion } from "framer-motion";

export default function Victory() {
  return (
    <div className="flex flex-col items-center gap-6 py-16">
      <motion.svg
        width="120"
        height="108"
        viewBox="0 0 120 108"
        className="anim-triforce"
        aria-label="Triforce"
      >
        <polygon points="60,0 30,52 90,52" fill="var(--gold-bright)" stroke="var(--gold)" strokeWidth="3" className="anim-shine" style={{ animationDelay: "0.9s" }} />
        <polygon points="30,54 0,106 60,106" fill="var(--gold-bright)" stroke="var(--gold)" strokeWidth="3" className="anim-shine" style={{ animationDelay: "1.1s" }} />
        <polygon points="90,54 60,106 120,106" fill="var(--gold-bright)" stroke="var(--gold)" strokeWidth="3" className="anim-shine" style={{ animationDelay: "1.3s" }} />
      </motion.svg>
      <div className="font-pixel text-[var(--gold-bright)] text-sm text-center leading-relaxed">
        QUEST COMPLETE !
      </div>
      <div className="text-xl opacity-80 text-center">Toutes les missives ont été traitées, héros.</div>
      <div className="flex gap-4 text-3xl">
        <span className="anim-sparkle">✨</span>
        <span className="anim-sparkle" style={{ animationDelay: "0.3s" }}>✨</span>
        <span className="anim-sparkle" style={{ animationDelay: "0.6s" }}>✨</span>
      </div>
    </div>
  );
}
