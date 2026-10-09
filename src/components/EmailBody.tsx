"use client";

import { useEffect, useRef, useState } from "react";
import { IconPhotoOff } from "@tabler/icons-react";

/**
 * Corps d'email HTML. Défense en profondeur :
 *  1. le HTML est déjà sanitizé côté serveur (sanitize-html : scripts,
 *     handlers on*, formulaires retirés ; liens forcés en _blank+noopener) ;
 *  2. rendu dans un iframe sandboxé SANS allow-scripts : aucun script ne
 *     peut s'exécuter quoi qu'il arrive ;
 *  3. allow-same-origin permet de lire contentDocument pour l'auto-hauteur ;
 *     allow-popups(-to-escape-sandbox) pour que les liens s'ouvrent en
 *     nouvel onglet ;
 *  4. images distantes masquées par défaut (variante htmlNoImg, anti
 *     pixel-espion) — bouton pour les afficher.
 */
export default function EmailBody({ html, htmlNoImg }: { html: string; htmlNoImg: string | null }) {
  const [showImg, setShowImg] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const observer = useRef<ResizeObserver | null>(null);

  const resize = () => {
    const doc = frameRef.current?.contentDocument;
    if (doc?.documentElement) frameRef.current!.style.height = `${doc.documentElement.scrollHeight}px`;
  };

  useEffect(() => () => observer.current?.disconnect(), []);

  const imagesHidden = htmlNoImg !== null && htmlNoImg !== html;

  return (
    <div className="flex flex-col gap-2">
      {imagesHidden && (
        <button
          type="button"
          className="self-start font-pixel text-[7px] text-[#8a6d3b] border border-[#8a6d3b] px-2 py-1 flex items-center gap-1.5 hover:bg-[#e8d9b0] transition-colors"
          onClick={() => setShowImg((v) => !v)}
        >
          <IconPhotoOff size={14} />
          {showImg ? "MASQUER LES IMAGES" : "IMAGES MASQUÉES — AFFICHER"}
        </button>
      )}
      <iframe
        ref={frameRef}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={wrap(showImg ? html : (htmlNoImg ?? html))}
        onLoad={() => {
          resize();
          // Les images/ressources embarquées peuvent changer la hauteur après load.
          const doc = frameRef.current?.contentDocument;
          observer.current?.disconnect();
          if (doc?.documentElement && typeof ResizeObserver !== "undefined") {
            observer.current = new ResizeObserver(resize);
            observer.current.observe(doc.documentElement);
          }
        }}
        className="w-full border-0 bg-[#f7ecc9]"
        title="Contenu du message"
      />
    </div>
  );
}

function wrap(body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>
html{background:#f7ecc9}
body{font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.45;color:#2a1c0e;margin:0;padding:2px;word-wrap:break-word;overflow-wrap:break-word}
img{max-width:100%;height:auto}
a{color:#2a5fb0}
blockquote{border-left:3px solid #8a6d3b;margin-left:0;padding-left:8px;opacity:.8}
pre{white-space:pre-wrap}
</style></head><body>${body}</body></html>`;
}
