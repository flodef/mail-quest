"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { IconRefresh, IconBell, IconBellOff, IconPackage, IconDeviceMobileDown, IconVolumeOff, IconWand, IconTrash, IconX, IconSword, IconArrowBackUp, IconNotebook, IconWifiOff, IconCalendarClock, IconSkull } from "@tabler/icons-react";
import { apiError } from "@/lib/client";
import { useAppBadge, useInstallPrompt, useOfflineSync, usePush, useToast, type Snapshot } from "@/lib/hooks";
import type { AgendaEvent, Note, Task } from "@/lib/db";
import type { Draft, DraftBody, InboxItem, MsgBody, OverviewAccount } from "@/lib/types";
import Hud from "@/components/Hud";
import DraftCard from "@/components/DraftCard";
import Sheet from "@/components/Sheet";
import Victory from "@/components/Victory";
import QuestPanel from "@/components/QuestPanel";
import NotesPanel from "@/components/NotesPanel";
import AgendaPanel from "@/components/AgendaPanel";
import InboxDrawer from "@/components/InboxDrawer";
import { DraftReader, MessageReader } from "@/components/MessageReader";
import ConfirmDialog from "@/components/ConfirmDialog";
import { parseNoteItems } from "@/lib/items";

export default function Game() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<OverviewAccount[]>([]);
  const [pile, setPile] = useState<Draft[]>([]);
  const [aside, setAside] = useState<Draft[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [reading, setReading] = useState<DraftBody | null>(null);
  const [showAside, setShowAside] = useState(false);
  const [inboxOf, setInboxOf] = useState<string | null>(null);
  const [inboxOrder, setInboxOrder] = useState<Record<string, number[]>>({});
  const [trash, setTrash] = useState<InboxItem[] | null>(null);
  const [readingMsg, setReadingMsg] = useState<MsgBody | null>(null);
  const [openingMsg, setOpeningMsg] = useState(false);
  const [readingCtx, setReadingCtx] = useState<Draft | null>(null);
  const [improveText, setImproveText] = useState<string | null>(null);
  const [muted, setMuted] = useState<{ account: string; sender: string }[]>([]);
  const [confirm, setConfirm] = useState<{ label: string; run: () => void } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [agenda, setAgenda] = useState<AgendaEvent[]>([]);
  const [showQuest, setShowQuest] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showAgenda, setShowAgenda] = useState(false);
  // Texte "Reforger la missive" en cours, conservé par missive si on ferme le popup.
  const [improveSaved, setImproveSaved] = useState<Record<string, string>>({});

  const { toast, say } = useToast();
  const { pushOn, togglePush } = usePush(say);
  const { canInstall, installApp } = useInstallPrompt(say);
  useAppBadge(pile.length);

  const applySnapshot = useCallback((s: Snapshot) => {
    setAccounts(s.accounts ?? []);
    setMuted(s.muted ?? []);
    setPile(s.pile ?? []);
    setAside(s.aside ?? []);
    setTasks(s.tasks ?? []);
    setNotes(s.notes ?? []);
    setAgenda(s.agenda ?? []);
    setInboxOrder(s.inboxOrder ?? {});
  }, []);

  const { mutate, refresh, pending, offline, loading } = useOfflineSync(applySnapshot);

  const json = (body: Record<string, unknown>): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const patch = (body: Record<string, unknown>): RequestInit => ({ ...json(body), method: "PATCH" });

  // Pré-remplit l'aperçu des 3 premières cartes (le listing drafts n'embarque pas le corps).
  useEffect(() => {
    const targets = pile.slice(0, 3).filter((d) => !d.preview);
    if (targets.length === 0) return;
    let cancelled = false;
    void Promise.all(
      targets.map(async (d) => {
        const r = await fetch(`/api/draft?account=${d.account}&uid=${d.uid}`);
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
    return () => {
      cancelled = true;
    };
  }, [pile]);

  const sameDraft = (x: Draft, d: Draft) => x.account === d.account && x.uid === d.uid;

  async function act(d: Draft, action: "send" | "aside" | "restore") {
    const key = `${d.account}:${d.uid}`;
    if (busy) return;
    setBusy(key);
    // UI optimiste : on retire/déplace la carte tout de suite ; en cas
    // d'échec, le refresh post-flush restaure l'état serveur.
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
        const r = await fetch("/api/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account: d.account, uid: d.uid }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "Échec");
        // SMTP OK mais déplacement du brouillon KO → on prévient plutôt que
        // de risquer un double envoi au prochain swipe.
        if (j.moved === false) say(`Envoyée à ${j.to} — mais le brouillon traîne encore`, IconSword);
        else say("La missive s'envole !", IconSword);
        await refresh();
      } else if (action === "aside") {
        // DB-only → file hors-ligne (rejoué au retour du réseau).
        mutate({ url: "/api/aside", init: json({ account: d.account, uid: d.uid }) });
        say("Rangée dans la jarre", IconPackage);
      } else {
        mutate({ url: "/api/aside", init: { ...json({ account: d.account, uid: d.uid }), method: "DELETE" } });
        say("De retour dans la quête", IconArrowBackUp);
      }
    } catch (e) {
      say(e instanceof Error ? e.message : "Erreur", IconSkull);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  // Retire des messages du tiroir inbox + ajuste le compteur de non-lus (optimiste).
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
    const r = await fetch(`/api/draft?account=${d.account}&uid=${d.uid}`);
    if (r.ok) setReading(await r.json());
  }

  async function readOriginal(d: Draft) {
    setOpeningMsg(true);
    try {
      const r = await fetch(`/api/message?account=${d.account}&to=${encodeURIComponent(d.to)}&subject=${encodeURIComponent(d.subject)}`);
      if (r.ok) {
        setReadingCtx(d);
        setImproveText(improveSaved[`${d.account}:${d.uid}`] ?? null);
        setReadingMsg(await r.json());
      } else say("Parchemin introuvable", IconSkull);
    } finally {
      setOpeningMsg(false);
    }
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
        body: JSON.stringify({ account: d.account, uid: d.uid, instructions: improveText.trim() }),
      });
      if (!r.ok) throw new Error(await apiError(r));
      const j = (await r.json().catch(() => ({}))) as { moved?: boolean };
      if (j.moved === false) say("Reforgée — mais l'originale traîne encore", IconWand);
      else say("Missive reforgée !", IconWand);
      const k = `${d.account}:${d.uid}`;
      setImproveSaved((s) => {
        const n = { ...s };
        delete n[k];
        return n;
      });
      setReadingMsg(null);
      setReadingCtx(null);
      setImproveText(null);
      await refresh();
    } catch (e) {
      say(e instanceof Error ? e.message : "Erreur", IconSkull);
      await refresh(); // restaure la carte retirée optimistement
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

  const sortTasks = (ts: Task[]) => ts.sort((a, b) => (a.done === b.done ? a.position - b.position : a.done ? 1 : -1));

  function questAdd(text: string) {
    // 1 ligne = 1 quête ; puces ("-", "•", …) ignorées, espaces trimmés.
    const lines = text
      .split("\n")
      .map((l) => l.replace(/^[•\-–—*]\s*/, "").trim())
      .filter(Boolean);
    if (!lines.length) return;
    const now = new Date().toISOString();
    const base = Math.min(0, ...tasks.map((x) => x.position)) - lines.length;
    const news = lines.map((t, i) => ({ id: crypto.randomUUID(), text: t, done: false, position: base + i, created_at: now }));
    setTasks((ts) => sortTasks([...ts, ...news]));
    mutate({ url: "/api/tasks", init: json({ texts: news.map(({ text, id }) => ({ text, id })) }) });
  }

  function questDone(id: string) {
    // Terminée → tout en haut des trophées (position la plus petite du groupe done).
    setTasks((ts) =>
      sortTasks(
        ts.map((t) =>
          t.id === id
            ? { ...t, done: true, position: Math.min(0, ...ts.filter((x) => x.done && x.id !== id).map((x) => x.position)) - 1 }
            : t,
        ),
      ),
    );
    mutate({ url: "/api/tasks", init: patch({ id, done: true }) });
    say("Quête accomplie !", IconSword);
  }

  function questUndone(id: string) {
    // Restaurée → tout en haut de la pile active (visible dans le top 5).
    setTasks((ts) =>
      sortTasks(
        ts.map((t) =>
          t.id === id
            ? { ...t, done: false, position: Math.min(0, ...ts.filter((x) => !x.done && x.id !== id).map((x) => x.position)) - 1 }
            : t,
        ),
      ),
    );
    mutate({ url: "/api/tasks", init: patch({ id, done: false }) });
  }

  function questBottom(id: string) {
    setTasks((ts) => {
      const max = Math.max(0, ...ts.map((t) => t.position));
      return sortTasks(ts.map((t) => (t.id === id ? { ...t, position: max + 1 } : t)));
    });
    mutate({ url: "/api/tasks", init: patch({ id, toBottom: true }) });
  }

  function questUpdate(id: string, text: string) {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, text } : t)));
    mutate({ url: "/api/tasks", init: patch({ id, text }) });
  }

  function questReorder(ids: string[]) {
    setTasks((ts) => {
      const pos = new Map(ids.map((id, i) => [id, i]));
      return sortTasks(ts.map((t) => (pos.has(t.id) ? { ...t, position: pos.get(t.id)! } : t)));
    });
    mutate({ url: "/api/tasks", init: patch({ order: ids }) });
  }

  const questPurge = () =>
    setConfirm({
      label: `Purger les ${tasks.filter((t) => t.done).length} quête(s) accomplie(s) ?`,
      run: () => {
        setTasks((ts) => ts.filter((t) => !t.done));
        mutate({ url: "/api/tasks?purge=1", init: { method: "DELETE" } });
        say("Trophées purgés", IconSkull);
      },
    });

  function noteAdd(body: string) {
    const t = body.trim();
    if (!t) return;
    const id = crypto.randomUUID();
    const first = t.split("\n").map((l) => l.replace(/^[•\-*✅\d.\s]+/, "").trim()).find(Boolean) ?? "Note";
    setNotes((ns) => [
      { id, title: first.slice(0, 60), body: t, position: Math.min(0, ...ns.map((n) => n.position)) - 1, created_at: new Date().toISOString() },
      ...ns,
    ]);
    mutate({ url: "/api/notes", init: json({ body: t, id }) });
    say("Note rangée au fourre-tout", IconNotebook);
  }

  const noteDelete = (id: string) =>
    setConfirm({
      label: "Jeter cette note à la potence ?",
      run: () => {
        setNotes((ns) => ns.filter((n) => n.id !== id));
        mutate({ url: `/api/notes?id=${id}`, init: { method: "DELETE" } });
        say("Note jetée", IconTrash);
      },
    });

  function noteUpdate(id: string, body: string) {
    setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, body } : n)));
    mutate({ url: "/api/notes", init: patch({ id, body }) });
  }

  function noteReorder(ids: string[]) {
    setNotes((ns) => {
      const pos = new Map(ids.map((id, i) => [id, i]));
      return [...ns].sort((a, b) => (pos.get(a.id) ?? a.position) - (pos.get(b.id) ?? b.position));
    });
    mutate({ url: "/api/notes", init: patch({ order: ids }) });
  }

  // --- Agenda (échéances datées + rappel mail) ---

  const sortAgenda = (es: AgendaEvent[]) =>
    [...es].sort((a, b) => (a.done === b.done ? +new Date(a.due_at) - +new Date(b.due_at) : a.done ? 1 : -1));

  function agendaAdd(text: string, dueAt: string, remindMinutes: number) {
    const id = crypto.randomUUID();
    setAgenda((es) => sortAgenda([...es, { id, text, due_at: dueAt, remind_minutes: remindMinutes, done: false, reminded_at: null, created_at: new Date().toISOString() }]));
    mutate({ url: "/api/agenda", init: json({ id, text, dueAt, remindMinutes }) });
    say("Échéance inscrite à l'agenda", IconCalendarClock);
  }

  function agendaDone(id: string) {
    setAgenda((es) => sortAgenda(es.map((e) => (e.id === id ? { ...e, done: true } : e))));
    mutate({ url: "/api/agenda", init: patch({ id, done: true }) });
  }

  function agendaUndone(id: string) {
    setAgenda((es) => sortAgenda(es.map((e) => (e.id === id ? { ...e, done: false } : e))));
    mutate({ url: "/api/agenda", init: patch({ id, done: false }) });
  }

  const agendaDelete = (id: string) =>
    setConfirm({
      label: "Jeter cette échéance à la potence ?",
      run: () => {
        setAgenda((es) => es.filter((e) => e.id !== id));
        mutate({ url: `/api/agenda?id=${id}`, init: { method: "DELETE" } });
        say("Échéance jetée", IconTrash);
      },
    });

  function agendaUpdate(id: string, text: string) {
    setAgenda((es) => es.map((e) => (e.id === id ? { ...e, text } : e)));
    mutate({ url: "/api/agenda", init: patch({ id, text }) });
  }

  function agendaSchedule(id: string, dueAt: string, remindMinutes: number) {
    setAgenda((es) => sortAgenda(es.map((e) => (e.id === id ? { ...e, due_at: dueAt, remind_minutes: remindMinutes, reminded_at: null } : e))));
    mutate({ url: "/api/agenda", init: patch({ id, dueAt, remindMinutes }) });
  }

  const clearJar = () =>
    setConfirm({
      label: `Briser la jarre ? Les ${aside.length} missive(s) fileront à la potence.`,
      run: doClearJar,
    });

  // Les missives sans ordre enregistré (nouveautés) arrivent en tête, puis
  // l'ordre de priorité choisi par le joueur (glisser ☰ dans le tiroir).
  function orderedInbox(acc: OverviewAccount): InboxItem[] {
    const list = acc.latest ?? [];
    const order = new Map((inboxOrder[acc.id] ?? []).map((uid, i) => [uid, i]));
    const known = list.filter((m) => order.has(m.uid)).sort((a, b) => (order.get(a.uid) ?? 0) - (order.get(b.uid) ?? 0));
    return [...list.filter((m) => !order.has(m.uid)), ...known];
  }

  function inboxReorder(accountId: string, next: InboxItem[]) {
    const uids = next.map((m) => m.uid);
    setInboxOrder((o) => ({ ...o, [accountId]: uids }));
    mutate({ url: "/api/inbox-order", init: json({ account: accountId, uids }) });
  }

  // Potence = corbeille IMAP du compte (chargée à la demande, pas cachée).
  async function loadTrash(accountId: string) {
    setTrash(null);
    const r = await fetch(`/api/trash?account=${accountId}`);
    if (r.ok) setTrash((await r.json()).items ?? []);
    else say("Potence illisible", IconSkull);
  }

  async function trashAction(m: InboxItem, action: "restore" | "purge") {
    if (busy) return;
    setBusy(`trash:${m.uid}`);
    try {
      const init = action === "restore" ? json({ account: m.account, uid: m.uid }) : { method: "DELETE" as const };
      const url = action === "restore" ? "/api/trash" : `/api/trash?account=${m.account}&uid=${m.uid}`;
      const r = await fetch(url, init);
      if (!r.ok) throw new Error(await apiError(r));
      setTrash((t) => t?.filter((x) => x.uid !== m.uid) ?? t);
      say(action === "restore" ? "Missive ressuscitée !" : "Missive réduite en cendres", action === "restore" ? IconArrowBackUp : IconSkull);
      if (action === "restore") await refresh();
    } catch (e) {
      say(e instanceof Error ? e.message : "Erreur", IconSkull);
    } finally {
      setBusy(null);
    }
  }

  const purgeTrashAll = () =>
    setConfirm({
      label: `Réduire en cendres les ${trash?.length ?? 0} missive(s) de la potence ? Irréversible !`,
      run: () =>
        void (async () => {
          if (!inbox) return;
          setBusy("trash:all");
          try {
            const r = await fetch(`/api/trash?account=${inbox.id}&all=1`, { method: "DELETE" });
            if (!r.ok) throw new Error(await apiError(r));
            setTrash([]);
            say("Potence purgée", IconSkull);
          } catch (e) {
            say(e instanceof Error ? e.message : "Erreur", IconSkull);
          } finally {
            setBusy(null);
          }
        })(),
    });

  async function readMsg(m: InboxItem) {
    setOpeningMsg(true);
    try {
      const r = await fetch(`/api/message?account=${m.account}&uid=${m.uid}`);
      if (r.ok) {
        setReadingCtx(null);
        setImproveText(null);
        setReadingMsg(await r.json());
      } else say("Parchemin illisible", IconSkull);
    } finally {
      setOpeningMsg(false);
    }
  }

  // Ferme la lecture d'une missive : le texte "Reforger" en cours est conservé
  // (par missive) pour être restauré à la prochaine ouverture.
  function closeReadingMsg() {
    if (readingCtx && improveText?.trim()) {
      setImproveSaved((s) => ({ ...s, [`${readingCtx.account}:${readingCtx.uid}`]: improveText }));
    }
    setReadingMsg(null);
    setReadingCtx(null);
    setImproveText(null);
  }

  async function msgAction(m: InboxItem, action: "generate" | "mute" | "delete" | "deleteAll" | "deleteAllGo" | "unmute") {
    const key = `msg:${m.account}:${m.uid}`;
    if (busy) return;
    setBusy(key);
    try {
      if (action === "generate") {
        say("La missive se forge…", IconWand);
        const r = await fetch("/api/message/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account: m.account, uid: m.uid }) });
        if (!r.ok) throw new Error(await apiError(r));
        say("Missive forgée !", IconWand);
        await refresh();
      } else if (action === "mute") {
        dropInboxItems(m.account, (x) => x.fromEmail === m.fromEmail);
        setMuted((p) => (p.some((x) => x.account === m.account && x.sender === m.fromEmail) ? p : [...p, { account: m.account, sender: m.fromEmail }]));
        mutate({ url: "/api/mute", init: json({ account: m.account, sender: m.fromEmail }) });
        say("Correspondant banni", IconVolumeOff);
      } else if (action === "unmute") {
        setMuted((p) => p.filter((x) => !(x.account === m.account && x.sender === m.fromEmail)));
        mutate({ url: "/api/mute", init: { ...json({ account: m.account, sender: m.fromEmail }), method: "DELETE" } });
        say("Correspondant gracié", IconBell);
      } else if (action === "delete") {
        dropInboxItems(m.account, (x) => x.uid === m.uid);
        const r = await fetch(`/api/message?account=${m.account}&uid=${m.uid}`, { method: "DELETE" });
        if (!r.ok) throw new Error(await apiError(r));
        say("Missive à la potence", IconTrash);
        await refresh();
      } else if (action === "deleteAll") {
        setBusy(null);
        setConfirm({
          label: `Jeter TOUTES les missives de ${m.from} à la potence ?`,
          run: () => void msgAction(m, "deleteAllGo"),
        });
        return;
      } else {
        // deleteAllGo — après confirmation (suppression par adresse exacte).
        dropInboxItems(m.account, (x) => x.fromEmail === m.fromEmail);
        const r = await fetch(`/api/message?account=${m.account}&sender=${encodeURIComponent(m.fromEmail)}`, { method: "DELETE" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "Échec");
        say(`${j.deleted ?? 0} missive(s) à la potence`, IconTrash);
        await refresh();
      }
    } catch (e) {
      say(e instanceof Error ? e.message : "Erreur", IconSkull);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  // Verrouillage : révoque la session serveur et purge le snapshot local
  // (métadonnées mails + quêtes stockées en clair dans localStorage).
  async function logout() {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch { /* offline : le cookie restera, expiré à sa date */ }
    try {
      localStorage.removeItem("mq-cache");
      localStorage.removeItem("mq-outbox");
    } catch { /* noop */ }
    router.push("/login");
  }

  const top = pile.slice(0, 3);
  const inbox = inboxOf ? accounts.find((a) => a.id === inboxOf) : null;

  return (
    <main className="min-h-dvh flex flex-col p-4 gap-4 max-w-md mx-auto w-full">
      <header className="flex items-center justify-between">
        <h1 className="font-pixel text-[var(--gold-bright)] text-xs">MAIL QUEST</h1>
        <div className="flex gap-2 items-center">
          {(offline || pending > 0) && (
            <span className="font-pixel text-[7px] text-[var(--gold-bright)] flex items-center gap-1" title={pending > 0 ? `${pending} modif(s) en attente` : "Hors-ligne"}>
              <IconWifiOff size={14} /> {pending > 0 ? `HORS-LIGNE (${pending})` : "HORS-LIGNE"}
            </span>
          )}
          {canInstall && (
            <button className="btn-pixel ghost !px-2" onClick={() => void installApp()} title="Installer l'app"><IconDeviceMobileDown size={18} /></button>
          )}
          <button className="btn-pixel ghost !px-2" onClick={() => void togglePush()} title="Notifications">
            {pushOn ? <IconBell size={18} /> : <IconBellOff size={18} />}
          </button>
          <button className="btn-pixel ghost !px-2" onClick={refresh} title="Rafraîchir"><IconRefresh size={18} /></button>
        </div>
      </header>

      <Hud accounts={accounts} onAccountTap={(id) => { setInboxOf(id); setTrash(null); }} />

      <div className="flex items-center justify-between">
        <div className="font-pixel text-[9px] opacity-80">MISSIVES À EXPÉDIER : {pile.length}</div>
        <div className="flex gap-1.5">
          <button className="btn-pixel ghost !px-2 !py-1 text-[9px] flex items-center gap-1" onClick={() => setShowAgenda(true)} title="Agenda">
            <IconCalendarClock size={16} /> {agenda.filter((e) => !e.done).length}
          </button>
          <button className="btn-pixel ghost !px-2 !py-1 text-[9px] flex items-center gap-1" onClick={() => setShowNotes(true)} title="Fourre-tout">
            <IconNotebook size={16} /> {notes.filter((n) => { const it = parseNoteItems(n.body); return it.length === 0 || it.some((i) => !i.done); }).length}
          </button>
          <button className="btn-pixel ghost !px-2 !py-1 text-[9px] flex items-center gap-1" onClick={() => setShowQuest(true)} title="Quêtes">
            <IconSword size={16} /> {tasks.filter((t) => !t.done).length}
          </button>
          <button className="btn-pixel ghost !px-2 !py-1 text-[9px] flex items-center gap-1" onClick={() => setShowAside(!showAside)} title="Jarre">
            <IconPackage size={16} /> {aside.length}
          </button>
        </div>
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

      {/* Panneaux toujours montés (cachés en CSS) : le texte en cours de
          saisie survit à la fermeture/réouverture. */}
      <div className={showQuest ? "contents" : "hidden"}>
        <QuestPanel
          tasks={tasks}
          busy={!!busy}
          onClose={() => setShowQuest(false)}
          onAdd={questAdd}
          onDone={questDone}
          onUndone={questUndone}
          onBottom={questBottom}
          onReorder={questReorder}
          onPurge={questPurge}
          onUpdate={questUpdate}
        />
      </div>

      <div className={showNotes ? "contents" : "hidden"}>
        <NotesPanel
          notes={notes}
          busy={!!busy}
          onClose={() => setShowNotes(false)}
          onAdd={noteAdd}
          onDelete={noteDelete}
          onUpdate={noteUpdate}
          onReorder={noteReorder}
        />
      </div>

      <div className={showAgenda ? "contents" : "hidden"}>
        <AgendaPanel
          events={agenda}
          busy={!!busy}
          open={showAgenda}
          onClose={() => setShowAgenda(false)}
          onAdd={agendaAdd}
          onDone={agendaDone}
          onUndone={agendaUndone}
          onDelete={agendaDelete}
          onUpdate={agendaUpdate}
          onSchedule={agendaSchedule}
        />
      </div>

      {/* Pile "de côté" */}
      {showAside && (
        <Sheet onClose={() => setShowAside(false)}>
          <div className="flex items-center justify-between">
            <div className="font-pixel text-[9px] text-[var(--gold-bright)]">LA JARRE AUX MISSIVES ({aside.length})</div>
            <div className="flex items-center gap-2">
              {aside.length > 0 && (
                <button className="btn-pixel danger !py-1.5 !px-2 text-[8px] flex items-center gap-1" disabled={!!busy} onClick={clearJar}>
                  <IconTrash size={16} /> Briser la jarre
                </button>
              )}
              <button className="btn-pixel ghost !px-2" onClick={() => setShowAside(false)}><IconX size={18} /></button>
            </div>
          </div>
          {aside.length === 0 && <div className="opacity-60">La jarre est vide.</div>}
          {aside.map((d) => (
            <div key={`${d.account}:${d.uid}`} className="flex items-center gap-3 bg-[var(--shadow)] p-3 border border-[#3a5a2a]">
              <div className="flex-1 min-w-0">
                <div className="truncate text-lg">
                  {d.to} — {d.subject}
                  {d.ai && <span className="font-pixel text-[6px] text-[#8a6d3b] ml-2" title="Forgée par l'IA">🤖</span>}
                </div>
                <div className="font-pixel text-[7px] opacity-60">{d.account}</div>
              </div>
              <button className="btn-pixel !py-2 !px-2.5" title="Renvoyer en quête" disabled={!!busy} onClick={() => act(d, "restore")}><IconArrowBackUp size={20} /></button>
              <button className="btn-pixel danger !py-2 !px-2.5" title="Expédier" disabled={!!busy} onClick={() => act(d, "send")}><IconSword size={20} /></button>
            </div>
          ))}
        </Sheet>
      )}

      {/* Tiroir inbox */}
      {inbox && (
        <InboxDrawer
          inbox={inbox}
          items={orderedInbox(inbox)}
          muted={muted}
          trash={trash}
          busy={!!busy}
          onClose={() => { setInboxOf(null); setTrash(null); }}
          onOpen={(m) => void readMsg(m)}
          onReorder={(next) => inboxReorder(inbox.id, next)}
          onAction={(m, action) => void msgAction(m, action)}
          onLoadTrash={() => void loadTrash(inbox.id)}
          onTrashAction={(m, action) => void trashAction(m, action)}
          onPurgeTrash={purgeTrashAll}
          onLogout={() => void logout()}
        />
      )}

      {/* Chargement d'une missive (IMAP peut prendre 1-2 s) */}
      {openingMsg && !readingMsg && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4">
          <div className="card-parchment max-w-md w-full p-5 text-center font-pixel text-[9px] text-[#8a6d3b] animate-pulse">
            Décachetage de la missive…
          </div>
        </div>
      )}

      {/* Lecture message inbox */}
      {readingMsg && (
        <MessageReader
          msg={readingMsg}
          ctx={readingCtx}
          improveText={improveText}
          busy={!!busy}
          onImproveText={setImproveText}
          onClose={closeReadingMsg}
          onImprove={() => void improveMissive()}
          onGenerate={(m) => { setReadingMsg(null); void msgAction(m, "generate"); }}
        />
      )}

      {/* Lecture draft */}
      {reading && (
        <DraftReader
          draft={reading}
          busy={!!busy}
          onClose={() => setReading(null)}
          onReadOriginal={(d) => { setReading(null); void readOriginal(d); }}
          onAside={(d) => { setReading(null); void act(d, "aside"); }}
          onSend={(d) => { setReading(null); void act(d, "send"); }}
        />
      )}

      {/* Confirmation stylée */}
      {confirm && (
        <ConfirmDialog
          label={confirm.label}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { const r = confirm.run; setConfirm(null); r(); }}
        />
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
