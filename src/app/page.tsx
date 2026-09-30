"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { IconRefresh, IconBell, IconBellOff, IconPackage, IconLogout, IconVolumeOff, IconWand, IconTrash, IconX, IconSword, IconArrowBackUp, IconMailOpened } from "@tabler/icons-react";
import Hud, { type AccountBadge } from "@/components/Hud";
import DraftCard, { type Draft } from "@/components/DraftCard";
import InboxRow, { fmtDate } from "@/components/InboxRow";
import Victory from "@/components/Victory";

interface InboxItem { account: string; uid: number; from: string; fromEmail: string; subject: string; date: string | null; unread: boolean }
interface OverviewAccount extends AccountBadge { latest?: InboxItem[] }
interface DraftBody extends Draft { html: string | null; text: string | null; cc: string }
interface MsgBody extends InboxItem { to: string; html: string | null; text: string | null }

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
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [readingMsg, setReadingMsg] = useState<MsgBody | null>(null);
  const [muted, setMuted] = useState<{ account: string; sender: string }[]>([]);
  const [confirm, setConfirm] = useState<{ label: string; run: () => void } | null>(null);

  const say = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const refresh = useCallback(async () => {
    const [ov, dr] = await Promise.all([
      fetch("/api/overview").then((r) => r.json()),
      fetch("/api/drafts").then((r) => r.json()),
    ]);
    setAccounts(ov.accounts ?? []);
    setMuted(ov.muted ?? []);
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

  // Pré-remplit l'aperçu des 3 premières cartes (le listing drafts n'embarque pas le corps)
  useEffect(() => {
    const targets = pile.slice(0, 3).filter((d) => !d.preview);
    if (targets.length === 0) return;
    let cancelled = false;
    void Promise.all(
      targets.map(async (d) => {
        const r = await fetch(`/api/draft?account=${d.account}&mailbox=${encodeURIComponent(d.mailbox)}&uid=${d.uid}`);
        if (!r.ok) return null;
        const j = (await r.json()) as { preview?: string; text?: string | null };
        return { key: `${d.account}:${d.uid}`, preview: j.preview || (j.text ?? "").replace(/\s+/g, " ").slice(0, 160) };
      }),
    ).then((rows) => {
      if (cancelled) return;
      const map = new Map(rows.filter((r): r is { key: string; preview: string } => !!r && !!r.preview).map((r) => [r.key, r.preview]));
      if (map.size === 0) return;
      setPile((prev) => prev.map((d) => (map.has(`${d.account}:${d.uid}`) ? { ...d, preview: map.get(`${d.account}:${d.uid}`)! } : d)));
    });
    return () => { cancelled = true; };
  }, [pile]);

  async function readOriginal(d: Draft) {
    const r = await fetch(`/api/message?account=${d.account}&to=${encodeURIComponent(d.to)}&subject=${encodeURIComponent(d.subject)}`);
    if (r.ok) setReadingMsg(await r.json());
    else say("💀 Message original introuvable");
  }

  async function doClearJar() {
    setBusy("jar");
    try {
      const r = await fetch("/api/aside/clear", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Échec");
      say(`🏺 Jarre vidée (${j.cleared ?? 0})`);
      await refresh();
    } catch (e) {
      say(`💀 ${e instanceof Error ? e.message : "Erreur"}`);
    } finally {
      setBusy(null);
    }
  }

  const clearJar = () => setConfirm({
    label: `Jeter les ${aside.length} missive(s) de la jarre à la Corbeille ?`,
    run: doClearJar,
  });

  async function readMsg(m: InboxItem) {
    const r = await fetch(`/api/message?account=${m.account}&uid=${m.uid}`);
    if (r.ok) setReadingMsg(await r.json());
    else say("💀 Lecture impossible");
  }

  async function msgAction(m: InboxItem, action: "generate" | "mute" | "delete" | "deleteAll" | "deleteAllGo" | "unmute") {
    setMenuFor(null);
    const key = `msg:${m.account}:${m.uid}`;
    if (busy) return;
    setBusy(key);
    try {
      if (action === "generate") {
        say("✨ Génération du draft…");
        const r = await fetch("/api/message/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account: m.account, uid: m.uid }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "Échec");
        say("✨ Draft généré !");
      } else if (action === "mute") {
        const r = await fetch("/api/mute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account: m.account, sender: m.fromEmail }) });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Échec");
        say("🔇 Expéditeur masqué");
      } else if (action === "unmute") {
        await fetch("/api/mute", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ account: m.account, sender: m.fromEmail }) });
        say("🔔 Expéditeur rétabli");
      } else if (action === "delete") {
        const r = await fetch(`/api/message?account=${m.account}&uid=${m.uid}`, { method: "DELETE" });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Échec");
        say("🗑 Message supprimé");
      } else if (action === "deleteAll") {
        setBusy(null);
        setConfirm({
          label: `Jeter TOUS les messages de ${m.from} à la Corbeille ?`,
          run: () => void msgAction(m, "deleteAllGo"),
        });
        return;
      } else {
        // deleteAllGo — après confirmation
        const r = await fetch(`/api/message?account=${m.account}&sender=${encodeURIComponent(m.fromEmail)}`, { method: "DELETE" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "Échec");
        say(`🗑 ${j.deleted ?? 0} message(s) supprimé(s)`);
      }
      await refresh();
    } catch (e) {
      say(`💀 ${e instanceof Error ? e.message : "Erreur"}`);
      await refresh();
    } finally {
      setBusy(null);
    }
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
                  onReadOriginal={() => readOriginal(d)}
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
          <button className="btn-pixel danger flex-1 flex items-center justify-center gap-2" disabled={!!busy} onClick={() => act(pile[0], "aside")}><IconPackage size={24} /> Côté</button>
          <button className="btn-pixel flex-1 flex items-center justify-center gap-2" disabled={!!busy} onClick={() => act(pile[0], "send")}><IconSword size={24} /> Envoyer</button>
        </div>
      )}

      {/* Pile "de côté" */}
      {showAside && (
        <div className="panel p-4 flex flex-col gap-3 max-h-[40dvh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="font-pixel text-[8px] text-[var(--gold-bright)]">JARRE DES MISSIVES MISES DE CÔTÉ</div>
            {aside.length > 0 && (
              <button className="btn-pixel danger !py-1.5 !px-2 text-[8px] flex items-center gap-1" disabled={!!busy} onClick={clearJar}>
                <IconTrash size={16} /> Tout supprimer
              </button>
            )}
          </div>
          {aside.length === 0 && <div className="opacity-60">Vide.</div>}
          {aside.map((d) => (
            <div key={`${d.account}:${d.uid}`} className="flex items-center gap-3 bg-[var(--shadow)] p-3 border border-[#3a5a2a]">
              <div className="flex-1 min-w-0">
                <div className="truncate text-lg">{d.to} — {d.subject}</div>
                <div className="font-pixel text-[7px] opacity-60">{d.account}</div>
              </div>
              <button className="btn-pixel !py-2 !px-2.5" title="Remettre dans la pile" disabled={!!busy} onClick={() => act(d, "restore")}><IconArrowBackUp size={20} /></button>
              <button className="btn-pixel danger !py-2 !px-2.5" title="Envoyer" disabled={!!busy} onClick={() => act(d, "send")}><IconSword size={20} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Tiroir inbox */}
      {inbox && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-end" onClick={() => { setInboxOf(null); setMenuFor(null); }}>
          <div className="panel w-full max-w-md mx-auto p-4 max-h-[70dvh] overflow-y-auto" onClick={(e) => { e.stopPropagation(); setMenuFor(null); }}>
            <div className="flex justify-between items-center mb-3">
              <div className="font-pixel text-[9px]" style={{ color: inbox.color }}>{inbox.label}</div>
              <button className="btn-pixel ghost !px-2" onClick={() => setInboxOf(null)}>✕</button>
            </div>
            {(inbox.latest ?? []).map((m) => (
              <div key={m.uid} className="relative">
                <InboxRow
                  unread={m.unread}
                  disabled={!!busy}
                  onOpen={() => readMsg(m)}
                  onToggleMenu={() => setMenuFor(menuFor === m.uid ? null : m.uid)}
                  onGenerate={() => void msgAction(m, "generate")}
                  onDelete={() => void msgAction(m, "delete")}
                >
                  <div className="flex items-start gap-2 pr-8">
                    <div className="text-lg leading-tight flex-1 min-w-0">{m.from}</div>
                    <div className="font-pixel text-[6px] opacity-50 pt-1.5 shrink-0">{fmtDate(m.date)}</div>
                  </div>
                  <div className="opacity-80 pr-8">{m.subject}</div>
                </InboxRow>
                {menuFor === m.uid && (
                  <div
                    ref={(el) => el?.scrollIntoView({ block: "nearest", behavior: "smooth" })}
                    className="absolute right-0 top-full z-50 panel p-1.5 flex flex-col gap-1 min-w-[240px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button className="btn-pixel ghost !py-2 !px-2 text-[8px] flex items-center gap-2 justify-start text-left" onClick={() => msgAction(m, "generate")}>
                      <IconWand size={18} /> Générer un draft
                    </button>
                    <button className="btn-pixel ghost !py-2 !px-2 text-[8px] flex items-center gap-2 justify-start text-left" onClick={() => msgAction(m, "mute")}>
                      <IconVolumeOff size={18} /> Muter ce destinataire
                    </button>
                    <button className="btn-pixel ghost !py-2 !px-2 text-[8px] flex items-center gap-2 justify-start text-left text-[var(--ruby)]" onClick={() => msgAction(m, "delete")}>
                      <IconTrash size={18} /> Supprimer
                    </button>
                    <button className="btn-pixel ghost !py-2 !px-2 text-[8px] flex items-center gap-2 justify-start text-left text-[var(--ruby)]" onClick={() => msgAction(m, "deleteAll")}>
                      <IconTrash size={18} /> Supprimer tout de ce destinataire
                    </button>
                  </div>
                )}
              </div>
            ))}
            {(inbox.latest ?? []).length === 0 && !inbox.error && <div className="opacity-60 py-4 text-center">Aucun message.</div>}
            {inbox.error && <div className="text-[var(--ruby)]">Erreur: {inbox.error}</div>}
            {muted.filter((mm) => mm.account === inbox.id).length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#2a4a2a]">
                <div className="font-pixel text-[7px] opacity-60 mb-2">EXPÉDITEURS MASQUÉS</div>
                {muted.filter((mm) => mm.account === inbox.id).map((mm) => (
                  <div key={mm.sender} className="flex items-center justify-between py-1.5 text-sm opacity-70">
                    <span className="truncate">{mm.sender}</span>
                    <button className="btn-pixel ghost !px-1.5 !py-1" title="Démuter"
                      onClick={() => msgAction({ account: mm.account, uid: 0, from: mm.sender, fromEmail: mm.sender, subject: "", date: null, unread: false }, "unmute")}>
                      <IconX size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lecture message inbox */}
      {readingMsg && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4" onClick={() => setReadingMsg(null)}>
          <div className="card-parchment max-w-md w-full max-h-[80dvh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="font-pixel text-[8px] text-[#8a6d3b] mb-1 break-all">DE : {readingMsg.from}</div>
            <div className="font-pixel text-[8px] text-[#8a6d3b] mb-3 break-words">SUJET : {readingMsg.subject}</div>
            {readingMsg.html
              ? <div className="prose-sm" dangerouslySetInnerHTML={{ __html: readingMsg.html }} />
              : <pre className="whitespace-pre-wrap text-lg leading-snug">{readingMsg.text ?? "(vide)"}</pre>}
            <div className="flex gap-3 mt-5">
              <button className="btn-pixel flex-1" disabled={!!busy}
                onClick={async () => { const m = readingMsg; setReadingMsg(null); await msgAction(m, "generate"); }}>
                <IconWand size={14} className="inline mr-1" /> Générer draft
              </button>
              <button className="btn-pixel ghost flex-1" onClick={() => setReadingMsg(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Lecture draft */}
      {reading && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4" onClick={() => setReading(null)}>
          <div className="card-parchment max-w-md w-full max-h-[80dvh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="font-pixel text-[8px] text-[#8a6d3b] mb-1 break-all">À : {reading.to}</div>
            <div className="font-pixel text-[8px] text-[#8a6d3b] mb-3 break-words">SUJET : {reading.subject}</div>
            {reading.html
              ? <div className="prose-sm" dangerouslySetInnerHTML={{ __html: reading.html }} />
              : <pre className="whitespace-pre-wrap text-lg leading-snug">{reading.text ?? "(vide)"}</pre>}
            <div className="flex flex-col gap-3 mt-5">
              <button className="btn-pixel ghost !text-[9px] flex items-center justify-center gap-2" disabled={!!busy}
                onClick={async () => { const d = reading; setReading(null); await readOriginal(d); }}>
                <IconMailOpened size={18} /> Lire le parchemin
              </button>
              <div className="flex gap-3">
                <button className="btn-pixel danger flex-1 flex items-center justify-center gap-2" onClick={() => { setReading(null); act(reading, "aside"); }}><IconPackage size={22} /> Côté</button>
                <button className="btn-pixel flex-1 flex items-center justify-center gap-2" disabled={!!busy} onClick={async () => { const d = reading; setReading(null); await act(d, "send"); }}><IconSword size={22} /> Envoyer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation stylée */}
      {confirm && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setConfirm(null)}>
          <div className="panel max-w-sm w-full p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="font-pixel text-[9px] text-[var(--ruby)]">⚠ ATTENTION, VOYAGEUR</div>
            <div className="text-lg leading-snug">{confirm.label}</div>
            <div className="flex gap-3">
              <button className="btn-pixel ghost flex-1" onClick={() => setConfirm(null)}>Non</button>
              <button className="btn-pixel danger flex-1" onClick={() => { const r = confirm.run; setConfirm(null); r(); }}>Oui</button>
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
