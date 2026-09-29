"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { IconRefresh, IconBell, IconBellOff, IconPackage, IconLogout } from "@tabler/icons-react";
import Hud, { type AccountBadge } from "@/components/Hud";
import DraftCard, { type Draft } from "@/components/DraftCard";
import Victory from "@/components/Victory";

interface InboxItem { account: string; uid: number; from: string; subject: string; date: string | null; unread: boolean }
interface OverviewAccount extends AccountBadge { latest?: InboxItem[] }
interface DraftBody extends Draft { html: string | null; text: string | null; cc: string }

export default function Game() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<OverviewAccount[]>([]);
  const [pile, setPile] = useState<Draft[]>([]);
  const [aside, setAside] = useState<Draft[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [reading, setReading] = useState<DraftBody | null>(null);
  const [showAside, setShowAside] = useState(false);
  const [inboxOf, setInboxOf] = useState<string | null>(null);
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const say = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const refresh = useCallback(async () => {
    const [ov, dr] = await Promise.all([
      fetch("/api/overview").then((r) => r.json()),
      fetch("/api/drafts").then((r) => r.json()),
    ]);
    setAccounts(ov.accounts ?? []);
    setPile(dr.active ?? []);
    setAside(dr.aside ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(id);
  }, [refresh]);

  // Push registration state
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setPushOn(!!sub);
    });
  }, []);

  async function togglePush() {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    if (pushOn) {
      const sub = await reg.pushManager.getSubscription();
      await sub?.unsubscribe();
      if (sub) await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      setPushOn(false);
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { say("Notifications refusées"); return; }
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
    await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
    setPushOn(true);
    say("🔔 Notifications activées");
  }

  async function act(d: Draft, action: "send" | "aside" | "restore") {
    const key = `${d.account}:${d.uid}`;
    if (busy) return;
    setBusy(key);
    try {
      if (action === "send") {
        const r = await fetch("/api/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(d) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        say("⚔ Missive envoyée !");
      } else if (action === "aside") {
        await fetch("/api/aside", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(d) });
        say("🏺 Mise de côté");
      } else {
        await fetch("/api/aside", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(d) });
        say("↩ De retour dans la quête");
      }
      await refresh();
    } catch (e) {
      say(`💀 ${e instanceof Error ? e.message : "Erreur"}`);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function read(d: Draft) {
    const r = await fetch(`/api/draft?account=${d.account}&mailbox=${encodeURIComponent(d.mailbox)}&uid=${d.uid}`);
    if (r.ok) setReading(await r.json());
  }

  const top = pile.slice(0, 3);
  const inbox = inboxOf ? accounts.find((a) => a.id === inboxOf) : null;

  return (
    <main className="min-h-dvh flex flex-col p-4 gap-4 max-w-md mx-auto w-full">
      <header className="flex items-center justify-between">
        <h1 className="font-pixel text-[var(--gold-bright)] text-xs">MAIL QUEST</h1>
        <div className="flex gap-2">
          <button className="btn-pixel ghost !px-2" onClick={togglePush} title="Notifications">
            {pushOn ? <IconBell size={18} /> : <IconBellOff size={18} />}
          </button>
          <button className="btn-pixel ghost !px-2" onClick={refresh} title="Rafraîchir"><IconRefresh size={18} /></button>
          <button className="btn-pixel ghost !px-2" onClick={async () => { await fetch("/api/auth", { method: "DELETE" }); router.push("/login"); }} title="Quitter"><IconLogout size={18} /></button>
        </div>
      </header>

      <Hud accounts={accounts} onAccountTap={(id) => setInboxOf(id)} />

      <div className="flex items-center justify-between">
        <div className="font-pixel text-[9px] opacity-80">MISSIVES : {pile.length}</div>
        <button className="btn-pixel ghost !px-2 !py-1 text-[8px] flex items-center gap-1" onClick={() => setShowAside(!showAside)}>
          <IconPackage size={14} /> ({aside.length})
        </button>
      </div>

      <div className="relative flex-1 min-h-[340px]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center font-pixel text-[10px] anim-hint">CHARGEMENT…</div>
        ) : pile.length === 0 ? (
          <Victory />
        ) : (
          <AnimatePresence>
            {[...top].reverse().map((d, i) => {
              const idx = top.length - 1 - i;
              return (
                <DraftCard
                  key={`${d.account}:${d.uid}`}
                  draft={d}
                  accountColor={accounts.find((a) => a.id === d.account)?.color ?? "#888"}
                  zIndex={10 + idx}
                  onSend={() => act(d, "send")}
                  onAside={() => act(d, "aside")}
                  onExpand={() => read(d)}
                />
              );
            })}
          </AnimatePresence>
        )}
        {pile.length > 0 && (
          <div className="absolute -bottom-2 inset-x-0 flex justify-between font-pixel text-[7px] opacity-60 pointer-events-none px-2">
            <span className="anim-hint">◀ DE CÔTÉ</span>
            <span className="anim-hint">ENVOYER ▶</span>
          </div>
        )}
      </div>

      {/* Boutons accessibles (fallback sans swipe) */}
      {pile.length > 0 && (
        <div className="flex gap-3 safe-bottom">
          <button className="btn-pixel danger flex-1" disabled={!!busy} onClick={() => act(pile[0], "aside")}>🏺 Côté</button>
          <button className="btn-pixel flex-1" disabled={!!busy} onClick={() => act(pile[0], "send")}>⚔ Envoyer</button>
        </div>
      )}

      {/* Pile "de côté" */}
      {showAside && (
        <div className="panel p-4 flex flex-col gap-3 max-h-[40dvh] overflow-y-auto">
          <div className="font-pixel text-[8px] text-[var(--gold-bright)]">JARRE DES MISSIVES MISES DE CÔTÉ</div>
          {aside.length === 0 && <div className="opacity-60">Vide.</div>}
          {aside.map((d) => (
            <div key={`${d.account}:${d.uid}`} className="flex items-center gap-3 bg-[var(--shadow)] p-3 border border-[#3a5a2a]">
              <div className="flex-1 min-w-0">
                <div className="truncate text-lg">{d.to} — {d.subject}</div>
                <div className="font-pixel text-[7px] opacity-60">{d.account}</div>
              </div>
              <button className="btn-pixel !py-1.5 !px-2 text-[8px]" disabled={!!busy} onClick={() => act(d, "restore")}>↩</button>
              <button className="btn-pixel danger !py-1.5 !px-2 text-[8px]" disabled={!!busy} onClick={() => act(d, "send")}>⚔</button>
            </div>
          ))}
        </div>
      )}

      {/* Tiroir inbox */}
      {inbox && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-end" onClick={() => setInboxOf(null)}>
          <div className="panel w-full max-w-md mx-auto p-4 max-h-[70dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <div className="font-pixel text-[9px]" style={{ color: inbox.color }}>{inbox.label}</div>
              <button className="btn-pixel ghost !px-2" onClick={() => setInboxOf(null)}>✕</button>
            </div>
            {(inbox.latest ?? []).map((m) => (
              <div key={m.uid} className={`py-3 border-b border-[#2a4a2a] ${m.unread ? "font-bold" : "opacity-60"}`}>
                <div className="text-lg leading-tight">{m.from}</div>
                <div className="opacity-80">{m.subject}</div>
              </div>
            ))}
            {inbox.error && <div className="text-[var(--ruby)]">Erreur: {inbox.error}</div>}
          </div>
        </div>
      )}

      {/* Lecture draft */}
      {reading && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4" onClick={() => setReading(null)}>
          <div className="card-parchment max-w-md w-full max-h-[80dvh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="font-pixel text-[8px] text-[#8a6d3b] mb-1">À : {reading.to}</div>
            <div className="font-pixel text-[8px] text-[#8a6d3b] mb-3">SUJET : {reading.subject}</div>
            {reading.html
              ? <div className="prose-sm" dangerouslySetInnerHTML={{ __html: reading.html }} />
              : <pre className="whitespace-pre-wrap text-lg leading-snug">{reading.text}</pre>}
            <div className="flex gap-3 mt-5">
              <button className="btn-pixel danger flex-1" onClick={() => { setReading(null); act(reading, "aside"); }}>🏺 Côté</button>
              <button className="btn-pixel flex-1" disabled={!!busy} onClick={async () => { const d = reading; setReading(null); await act(d, "send"); }}>⚔ Envoyer</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none">
          <div className="panel px-5 py-3 font-pixel text-[9px] text-[var(--gold-bright)]">{toast}</div>
        </div>
      )}
    </main>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
