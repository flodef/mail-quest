"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { IconRefresh, IconBell, IconBellOff, IconPackage, IconLogout, IconVolumeOff, IconWand, IconTrash, IconX, IconSword, IconArrowBackUp, IconMailOpened, IconSkull } from "@tabler/icons-react";
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
  const [toast, setToast] = useState<{ msg: string; Icon?: typeof IconSword } | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [readingMsg, setReadingMsg] = useState<MsgBody | null>(null);
  const [readingCtx, setReadingCtx] = useState<Draft | null>(null);
  const [improveText, setImproveText] = useState<string | null>(null);
  const [muted, setMuted] = useState<{ account: string; sender: string }[]>([]);
  const [confirm, setConfirm] = useState<{ label: string; run: () => void } | null>(null);

  const say = (msg: string, Icon?: typeof IconSword) => { setToast({ msg, Icon }); setTimeout(() => setToast(null), 2500); };

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
    if (perm !== "granted") { say("Le héraut restera muet", IconBellOff); return; }
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
    await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
    setPushOn(true);
    say("Le héraut te préviendra", IconBell);
  }

  const sameDraft = (x: Draft, d: Draft) => x.account === d.account && x.uid === d.uid;

  async function act(d: Draft, action: "send" | "aside" | "restore") {
    const key = `${d.account}:${d.uid}`;
    if (busy) return;
    setBusy(key);
    // UI optimiste : on retire/déplace la carte tout de suite ; en cas d'échec, refresh() la restaure
    if (action === "aside") {
      setPile((p) => p.filter((x) => !sameDraft(x, d)));
      setAside((p) => (p.some((x) => sameDraft(x, d)) ? p : [d, ...p]));
    } else if (action === "restore") {
      setAside((p) => p.filter((x) => !sameDraft(x, d)));
      setPile((p) => (p.some((x) => sameDraft(x, d)) ? p : [d, ...p]));
    } else {
      setPile((p) => p.filter((x) => !sameDraft(x, d)));
      setAside((p) => p.filter((x) => !sameDraft(x, d)));
    }
    try {
      if (action === "send") {
        const r = await fetch("/api/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(d) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        say("La missive s'envole !", IconSword);
      } else if (action === "aside") {
        const r = await fetch("/api/aside", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(d) });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Échec");
        say("Rangée dans la jarre", IconPackage);
      } else {
        const r = await fetch("/api/aside", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(d) });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Échec");
        say("De retour dans la quête", IconArrowBackUp);
      }
      await refresh();
    } catch (e) {
      say(e instanceof Error ? e.message : "Erreur", IconSkull);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  // Retire des messages du tiroir inbox + ajuste le compteur de non-lus (optimiste)
  function dropInboxItems(accountId: string, pred: (m: InboxItem) => boolean) {
    setAccounts((prev) =>
      prev.map((a) => {
        if (a.id !== accountId) return a;
        const latest = a.latest ?? [];
        const removedUnread = latest.filter((x) => pred(x) && x.unread).length;
        return { ...a, latest: latest.filter((x) => !pred(x)), unseen: Math.max(0, (a.unseen ?? 0) - removedUnread) };
      }),
    );
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
    if (r.ok) { setReadingCtx(d); setImproveText(null); setReadingMsg(await r.json()); }
    else say("Parchemin introuvable", IconSkull);
  }

  async function improveMissive() {
    const d = readingCtx;
    if (!d || !improveText?.trim()) return;
    setBusy("improve");
    setPile((p) => p.filter((x) => !sameDraft(x, d)));
    setAside((p) => p.filter((x) => !sameDraft(x, d)));
    try {
      const r = await fetch("/api/draft/improve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: d.account, mailbox: d.mailbox, uid: d.uid, instructions: improveText.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Échec");
      say("Missive reforgée !", IconWand);
      setReadingMsg(null); setReadingCtx(null); setImproveText(null);
      await refresh();
    } catch (e) {
      say(e instanceof Error ? e.message : "Erreur", IconSkull);
    } finally {
      setBusy(null);
    }
  }

  async function doClearJar() {
    setBusy("jar");
    setAside([]);
    try {
      const r = await fetch("/api/aside/clear", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Échec");
      say(`Jarre brisée : ${j.cleared ?? 0} missive(s) jetée(s)`, IconPackage);
      await refresh();
    } catch (e) {
      say(e instanceof Error ? e.message : "Erreur", IconSkull);
    } finally {
      setBusy(null);
    }
  }

  const clearJar = () => setConfirm({
    label: `Briser la jarre ? Les ${aside.length} missive(s) fileront à la potence.`,
    run: doClearJar,
  });

  async function readMsg(m: InboxItem) {
    const r = await fetch(`/api/message?account=${m.account}&uid=${m.uid}`);
    if (r.ok) { setReadingCtx(null); setImproveText(null); setReadingMsg(await r.json()); }
    else say("Parchemin illisible", IconSkull);
  }

  async function msgAction(m: InboxItem, action: "generate" | "mute" | "delete" | "deleteAll" | "deleteAllGo" | "unmute") {
    setMenuFor(null);
    const key = `msg:${m.account}:${m.uid}`;
    if (busy) return;
    setBusy(key);
    try {
      if (action === "generate") {
        say("La missive se forge…", IconWand);
        const r = await fetch("/api/message/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account: m.account, uid: m.uid }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "Échec");
        say("Missive forgée !", IconWand);
      } else if (action === "mute") {
        dropInboxItems(m.account, (x) => x.fromEmail === m.fromEmail);
        setMuted((p) => (p.some((x) => x.account === m.account && x.sender === m.fromEmail) ? p : [...p, { account: m.account, sender: m.fromEmail }]));
        const r = await fetch("/api/mute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account: m.account, sender: m.fromEmail }) });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Échec");
        say("Correspondant banni", IconVolumeOff);
      } else if (action === "unmute") {
        setMuted((p) => p.filter((x) => !(x.account === m.account && x.sender === m.fromEmail)));
        await fetch("/api/mute", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ account: m.account, sender: m.fromEmail }) });
        say("Correspondant gracié", IconBell);
      } else if (action === "delete") {
        dropInboxItems(m.account, (x) => x.uid === m.uid);
        const r = await fetch(`/api/message?account=${m.account}&uid=${m.uid}`, { method: "DELETE" });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Échec");
        say("Missive à la potence", IconTrash);
      } else if (action === "deleteAll") {
        setBusy(null);
        setConfirm({
          label: `Jeter TOUTES les missives de ${m.from} à la potence ?`,
          run: () => void msgAction(m, "deleteAllGo"),
        });
        return;
      } else {
        // deleteAllGo — après confirmation
        dropInboxItems(m.account, (x) => x.fromEmail === m.fromEmail);
        const r = await fetch(`/api/message?account=${m.account}&sender=${encodeURIComponent(m.fromEmail)}`, { method: "DELETE" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "Échec");
        say(`${j.deleted ?? 0} missive(s) à la potence`, IconTrash);
      }
      await refresh();
    } catch (e) {
      say(e instanceof Error ? e.message : "Erreur", IconSkull);
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
        <div className="font-pixel text-[9px] opacity-80">MISSIVES À EXPÉDIER : {pile.length}</div>
        <button className="btn-pixel ghost !px-2 !py-1 text-[8px] flex items-center gap-1" onClick={() => setShowAside(!showAside)}>
          <IconPackage size={14} /> JARRE ({aside.length})
        </button>
      </div>

      <div className="relative flex-1 min-h-[340px]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center font-pixel text-[10px] anim-hint">LE VOYAGE COMMENCE…</div>
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
            <span className="anim-hint">◀ À LA JARRE</span>
            <span className="anim-hint">EXPÉDIER ▶</span>
          </div>
        )}
      </div>

      {/* Boutons accessibles (fallback sans swipe) */}
      {pile.length > 0 && (
        <div className="flex gap-3 safe-bottom">
          <button className="btn-pixel danger flex-1 flex items-center justify-center gap-2" disabled={!!busy} onClick={() => act(pile[0], "aside")}><IconPackage size={24} /> Jarre</button>
          <button className="btn-pixel flex-1 flex items-center justify-center gap-2" disabled={!!busy} onClick={() => act(pile[0], "send")}><IconSword size={24} /> Expédier</button>
        </div>
      )}

      {/* Pile "de côté" */}
      {showAside && (
        <div className="panel p-4 flex flex-col gap-3 max-h-[40dvh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="font-pixel text-[8px] text-[var(--gold-bright)]">LA JARRE AUX MISSIVES</div>
            {aside.length > 0 && (
              <button className="btn-pixel danger !py-1.5 !px-2 text-[8px] flex items-center gap-1" disabled={!!busy} onClick={clearJar}>
                <IconTrash size={16} /> Briser la jarre
              </button>
            )}
          </div>
          {aside.length === 0 && <div className="opacity-60">La jarre est vide.</div>}
          {aside.map((d) => (
            <div key={`${d.account}:${d.uid}`} className="flex items-center gap-3 bg-[var(--shadow)] p-3 border border-[#3a5a2a]">
              <div className="flex-1 min-w-0">
                <div className="truncate text-lg">{d.to} — {d.subject}</div>
                <div className="font-pixel text-[7px] opacity-60">{d.account}</div>
              </div>
              <button className="btn-pixel !py-2 !px-2.5" title="Renvoyer en quête" disabled={!!busy} onClick={() => act(d, "restore")}><IconArrowBackUp size={20} /></button>
              <button className="btn-pixel danger !py-2 !px-2.5" title="Expédier" disabled={!!busy} onClick={() => act(d, "send")}><IconSword size={20} /></button>
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
                  <div className="flex items-baseline gap-2 pr-8">
                    <div className="text-lg leading-tight flex-1 min-w-0">{m.from}</div>
                    <div className="font-pixel text-[6px] opacity-50 shrink-0 pr-6">{fmtDate(m.date)}</div>
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
                      <IconWand size={18} /> Forger une missive
                    </button>
                    <button className="btn-pixel ghost !py-2 !px-2 text-[8px] flex items-center gap-2 justify-start text-left" onClick={() => msgAction(m, "mute")}>
                      <IconVolumeOff size={18} /> Bannir ce correspondant
                    </button>
                    <button className="btn-pixel ghost !py-2 !px-2 text-[8px] flex items-center gap-2 justify-start text-left text-[var(--ruby)]" onClick={() => msgAction(m, "delete")}>
                      <IconTrash size={18} /> Jeter à la potence
                    </button>
                    <button className="btn-pixel ghost !py-2 !px-2 text-[8px] flex items-center gap-2 justify-start text-left text-[var(--ruby)]" onClick={() => msgAction(m, "deleteAll")}>
                      <IconTrash size={18} /> Tout jeter de ce correspondant
                    </button>
                  </div>
                )}
              </div>
            ))}
            {(inbox.latest ?? []).length === 0 && !inbox.error && <div className="opacity-60 py-4 text-center">Aucune missive dans cette boîte.</div>}
            {inbox.error && <div className="text-[var(--ruby)]">Erreur: {inbox.error}</div>}
            {muted.filter((mm) => mm.account === inbox.id).length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#2a4a2a]">
                <div className="font-pixel text-[7px] opacity-60 mb-2">CORRESPONDANTS BANNIS</div>
                {muted.filter((mm) => mm.account === inbox.id).map((mm) => (
                  <div key={mm.sender} className="flex items-center justify-between py-1.5 text-sm opacity-70">
                    <span className="truncate">{mm.sender}</span>
                    <button className="btn-pixel ghost !px-1.5 !py-1" title="Gracier"
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
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4" onClick={() => { setReadingMsg(null); setReadingCtx(null); setImproveText(null); }}>
          <div className="card-parchment max-w-md w-full max-h-[80dvh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="font-pixel text-[8px] text-[#8a6d3b] mb-1 break-all">DE : {readingMsg.from}</div>
            <div className="font-pixel text-[8px] text-[#8a6d3b] mb-3 break-words">SUJET : {readingMsg.subject}</div>
            {readingMsg.html
              ? <div className="prose-sm" dangerouslySetInnerHTML={{ __html: readingMsg.html }} />
              : <pre className="whitespace-pre-wrap text-lg leading-snug">{readingMsg.text ?? "(vide)"}</pre>}
            {readingCtx ? (
              <div className="flex flex-col gap-3 mt-5">
                {improveText !== null ? (
                  <>
                    <textarea
                      className="panel w-full p-3 text-base min-h-[90px] text-[#2a1c0e] bg-[#f7ecc9]"
                      placeholder="Tes ordres, héros ? (ex : souhaite-lui bon anniversaire, plus court, ton plus formel…)"
                      autoFocus
                      value={improveText}
                      onChange={(e) => setImproveText(e.target.value)}
                    />
                    <div className="flex gap-3">
                      <button className="btn-pixel ghost flex-1" onClick={() => setImproveText(null)}>Annuler</button>
                      <button className="btn-pixel flex-1 flex items-center justify-center gap-2" disabled={!!busy || !improveText.trim()} onClick={() => void improveMissive()}>
                        <IconWand size={18} /> Reforger
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex gap-3">
                    <button className="btn-pixel flex-1 flex items-center justify-center gap-2" disabled={!!busy} onClick={() => setImproveText("")}>
                      <IconWand size={18} /> Reforger la missive
                    </button>
                    <button className="btn-pixel ghost flex-1" onClick={() => { setReadingMsg(null); setReadingCtx(null); }}>Fermer</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-3 mt-5">
                <button className="btn-pixel flex-1" disabled={!!busy}
                  onClick={async () => { const m = readingMsg; setReadingMsg(null); await msgAction(m, "generate"); }}>
                  <IconWand size={16} className="inline mr-1" /> Forger une missive
                </button>
                <button className="btn-pixel ghost flex-1" onClick={() => setReadingMsg(null)}>Fermer</button>
              </div>
            )}
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
                <button className="btn-pixel danger flex-1 flex items-center justify-center gap-2" onClick={() => { setReading(null); act(reading, "aside"); }}><IconPackage size={22} /> Jarre</button>
                <button className="btn-pixel flex-1 flex items-center justify-center gap-2" disabled={!!busy} onClick={async () => { const d = reading; setReading(null); await act(d, "send"); }}><IconSword size={22} /> Expédier</button>
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
          <div className="panel px-5 py-3 font-pixel text-[9px] text-[var(--gold-bright)] flex items-center gap-2.5">
            {toast.Icon && <toast.Icon size={24} />}
            {toast.msg}
          </div>
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
