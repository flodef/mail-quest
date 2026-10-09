import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import sanitizeHtml from "sanitize-html";
import MailComposer from "nodemailer/lib/mail-composer";
import type { MailAccount } from "./accounts";

export interface DraftSummary {
  account: string;
  mailbox: string;
  uid: number;
  to: string;
  subject: string;
  date: string | null;
  preview: string;
  /** Brouillon généré par l'IA (en-tête X-Mail-Quest: ai). */
  ai?: boolean;
}

export interface DraftFull extends DraftSummary {
  /** HTML nettoyé (scripts/handlers/formulaires retirés, liens sécurisés). */
  html: string | null;
  /** Variante sans images distantes (anti pixel-espion). */
  htmlNoImg: string | null;
  text: string | null;
  cc: string;
}

export interface InboxItem {
  account: string;
  uid: number;
  from: string;
  fromEmail: string;
  subject: string;
  date: string | null;
  unread: boolean;
  hasAttachment?: boolean;
}

export interface AttachmentMeta {
  index: number;
  filename: string;
  contentType: string;
  size: number;
}

export interface InboxFull extends InboxItem {
  to: string;
  html: string | null;
  htmlNoImg: string | null;
  text: string | null;
  attachments?: AttachmentMeta[];
  replyTo?: string;
  replyToEmail?: string;
  messageId?: string;
}

// Circuit-breaker anti-verrouillage : un échec d'authentification suspend les
// appels IMAP du compte pendant 30 min. Certains hébergeurs (Free) bloquent le
// compte après des échecs répétés — un mot de passe périmé ne doit pas marteler.
// NOTE : en mémoire, propre à l'instance — un déploiement multi-instance peut
// laisser passer des échecs sur d'autres instances (limite connue, à partager
// en DB si ça devient un problème).
const authFailAt = new Map<string, number>();
const AUTH_COOLDOWN_MS = 30 * 60 * 1000;

function authSuspendedUntil(accountId: string): number | null {
  const at = authFailAt.get(accountId);
  return at && Date.now() - at < AUTH_COOLDOWN_MS ? at + AUTH_COOLDOWN_MS : null;
}

function isAuthError(e: unknown): boolean {
  const err = e as { authenticationFailed?: boolean; response?: string; message?: string };
  return Boolean(
    err?.authenticationFailed ||
      /authentication|credential|AUTHENTICATIONFAILED/i.test(err?.response ?? err?.message ?? ""),
  );
}

async function withClient<T>(acc: MailAccount, fn: (c: ImapFlow) => Promise<T>): Promise<T> {
  const until = authSuspendedUntil(acc.id);
  if (until) {
    throw new Error(`compte suspendu encore ${Math.ceil((until - Date.now()) / 60000)} min (échec d'authentification)`);
  }
  const client = new ImapFlow({
    host: acc.imap.host,
    port: acc.imap.port,
    secure: acc.imap.secure,
    auth: { user: acc.imap.user, pass: acc.imap.password },
    logger: false,
    socketTimeout: 20000,
  });
  try {
    await client.connect();
    const out = await fn(client);
    authFailAt.delete(acc.id);
    return out;
  } catch (e) {
    if (isAuthError(e)) authFailAt.set(acc.id, Date.now());
    throw e;
  } finally {
    try { await client.logout(); } catch { /* noop */ }
  }
}

function iso(d: string | Date | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : d;
}

// --- Helpers d'extraction partagés ---

/** Adresses d'un champ d'en-tête parsé (from/to/cc/replyTo). */
function addrList(v: AddressObject | AddressObject[] | undefined): { email: string; name: string }[] {
  if (!v) return [];
  const groups = Array.isArray(v) ? v : [v];
  return groups.flatMap((g) => g.value.map((a) => ({ email: (a.address ?? "").trim(), name: (a.name ?? "").trim() })));
}

/** "Nom <a@b>" pour l'affichage. */
function addrDisplay(v: AddressObject | AddressObject[] | undefined): string {
  return addrList(v).map((a) => (a.name && a.email ? `${a.name} <${a.email}>` : a.email || a.name)).filter(Boolean).join(", ");
}

/** Première adresse, en minuscules — pour les correspondances expéditeur. */
function firstAddr(v: AddressObject | AddressObject[] | undefined): string {
  return (addrList(v)[0]?.email ?? "").toLowerCase();
}

// Correspondance expéditeur EXACTE (insensible à la casse) — un "includes"
// transformerait "banni a@b.com" en "banni aussi aa@b.com / a@b.com.fr".
const sameSender = (fromEmail: string, want: string) => fromEmail.toLowerCase() === want.toLowerCase();

// LIST des mailboxes mis en cache par connexion (drafts+trash résolus en 1 appel).
const mailboxCache = new WeakMap<ImapFlow, Awaited<ReturnType<ImapFlow["list"]>>>();

async function findMailbox(client: ImapFlow, special: string, fallbacks: string[]): Promise<string | null> {
  let all = mailboxCache.get(client);
  if (!all) {
    all = await client.list();
    mailboxCache.set(client, all);
  }
  const bySpecial = all.find((b) => b.specialUse === special);
  if (bySpecial) return bySpecial.path;
  for (const fb of fallbacks) {
    const hit = all.find(
      (b) => b.path.toLowerCase() === fb.toLowerCase() || b.path.toLowerCase().endsWith("." + fb.toLowerCase()),
    );
    if (hit) return hit.path;
  }
  return null;
}

export async function draftsMailbox(client: ImapFlow): Promise<string> {
  return (await findMailbox(client, "\\Drafts", ["Drafts", "Brouillons", "INBOX.Drafts", "INBOX.INBOX.Drafts"])) ?? "Drafts";
}

export async function trashMailbox(client: ImapFlow): Promise<string> {
  return (await findMailbox(client, "\\Trash", ["Trash", "Corbeille", "INBOX.Trash", "INBOX.INBOX.Trash"])) ?? "Trash";
}

// --- Sanitisation HTML des mails (XSS + pixels-espions) ---

const SANITIZE_BASE: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "img", "center", "font", "html", "head", "body",
  ],
  allowedAttributes: {
    // target + rel doivent être autorisés : transformTags les injecte avant
    // le filtrage des attributs, sinon ils sont retirés.
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    "*": ["style", "class", "dir", "align", "valign", "bgcolor", "color", "face", "size", "cellpadding", "cellspacing", "border", "width", "height"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel", "data", "cid"],
  // data: uniquement sur <img> — un lien data:text/html serait du markup
  // injectable en nouvel onglet (les navigateurs bloquent, ceinture+bretelles).
  allowedSchemesByTag: { img: ["http", "https", "data", "cid"], a: ["http", "https", "mailto", "tel"] },
  allowProtocolRelative: false,
  transformTags: {
    // Liens vers l'extérieur forcés en nouvel onglet sans window.opener.
    a: (tag, attribs) => ({
      tagName: "a",
      attribs: { href: attribs.href ?? "", target: "_blank", rel: "noopener noreferrer nofollow" },
    }),
  },
};

const SANITIZE_NO_IMG: sanitizeHtml.IOptions = {
  ...SANITIZE_BASE,
  // Variante « sans images distantes » : seules les images embarquées restent.
  allowedSchemesByTag: { img: ["data", "cid"], a: ["http", "https", "mailto", "tel"] },
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    // Surtout PAS de `style` : sanitize-html ne filtre pas le contenu CSS —
    // background-image/list-style-image/content:url(tracker) passeraient et
    // contourneraient le blocage des pixels-espions.
    "*": ["class", "dir", "align", "valign", "bgcolor", "color", "face", "size", "cellpadding", "cellspacing", "border", "width", "height"],
  },
};

export const sanitizeBody = (html: string | false | undefined, images: boolean): string | null =>
  typeof html === "string" && html ? sanitizeHtml(html, images ? SANITIZE_BASE : SANITIZE_NO_IMG) : null;

// Part MIME feuille = pièce jointe si disposition "attachment" ou un filename est porté.
function withAttachment(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const n = node as {
    disposition?: string;
    dispositionParameters?: { filename?: string };
    parameters?: { name?: string };
    childNodes?: unknown[];
  };
  if (n.disposition === "attachment" || n.dispositionParameters?.filename) return true;
  return (n.childNodes ?? []).some(withAttachment);
}

// --- Drafts ---

const AI_HEADER = "x-mail-quest";
// Valeur exacte "ai" — un "X-Mail-Quest: no" ou un préfixe ressemblant ne
// doit pas marquer le brouillon.
const hasAiMark = (headers: ParsedMail["headers"]) => {
  const v = headers?.get(AI_HEADER);
  const s = typeof v === "string" ? v : (v as { value?: string } | undefined)?.value;
  return s?.trim().toLowerCase() === "ai";
};

async function listDraftsOn(client: ImapFlow, acc: MailAccount): Promise<DraftSummary[]> {
  const box = await draftsMailbox(client);
  const lock = await client.getMailboxLock(box);
  try {
    const out: DraftSummary[] = [];
    for await (const msg of client.fetch("1:*", { envelope: true, headers: [AI_HEADER] }, { uid: true })) {
      const env = msg.envelope;
      const to = (env?.to ?? []).map((a) => a.address ?? a.name ?? "").filter(Boolean).join(", ");
      out.push({
        account: acc.id,
        mailbox: box,
        uid: msg.uid,
        to,
        subject: env?.subject ?? "(sans sujet)",
        date: iso(env?.date),
        preview: "",
        // L'en-tête brut est recherché ligne par ligne : "x-mail-quest: ai"
        // exact — ni "X-Mail-Quest-Extra:", ni une autre valeur.
        ai: /(?:^|\r?\n)x-mail-quest:\s*ai\s*$/im.test(msg.headers?.toString() ?? "") || undefined,
      });
    }
    return out;
  } finally {
    lock.release();
  }
}

export async function listDrafts(acc: MailAccount): Promise<DraftSummary[]> {
  return withClient(acc, (client) => listDraftsOn(client, acc));
}

async function downloadRaw(client: ImapFlow, uid: number): Promise<Buffer | null> {
  const raw = await client.download(String(uid), undefined, { uid: true });
  if (!raw?.content) return null;
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    raw.content!.on("data", (c: Buffer) => chunks.push(c));
    raw.content!.on("end", () => resolve(Buffer.concat(chunks)));
    raw.content!.on("error", reject);
  });
}

/** Parse complet d'un raw MIME → InboxFull/DraftFull (sans account/uid). */
function parseFull(parsed: ParsedMail) {
  const replyTo = addrList(parsed.replyTo);
  return {
    from: addrDisplay(parsed.from) || (parsed.from?.text ?? ""),
    fromEmail: firstAddr(parsed.from),
    to: addrDisplay(parsed.to),
    cc: addrDisplay(parsed.cc),
    replyTo: addrDisplay(parsed.replyTo) || undefined,
    replyToEmail: replyTo[0]?.email.toLowerCase() || undefined,
    messageId: parsed.messageId || undefined,
    subject: parsed.subject ?? "(sans sujet)",
    date: iso(parsed.date),
    preview: (parsed.text ?? "").replace(/\s+/g, " ").slice(0, 140),
    html: sanitizeBody(parsed.html, true),
    htmlNoImg: sanitizeBody(parsed.html, false),
    text: parsed.text ?? null,
    attachments: (parsed.attachments ?? []).map((a, index) => ({
      index,
      filename: a.filename ?? `piece-jointe-${index + 1}`,
      contentType: a.contentType ?? "application/octet-stream",
      size: a.size ?? 0,
    })),
    ai: hasAiMark(parsed.headers) || undefined,
  };
}

// La boîte à brouillons est résolue côté serveur — jamais depuis le client.
export async function getDraft(acc: MailAccount, uid: number): Promise<DraftFull | null> {
  return withClient(acc, async (client) => {
    const box = await draftsMailbox(client);
    const lock = await client.getMailboxLock(box);
    try {
      const buf = await downloadRaw(client, uid);
      if (!buf) return null;
      const parsed: ParsedMail = await simpleParser(buf);
      const f = parseFull(parsed);
      return {
        account: acc.id,
        mailbox: box,
        uid,
        to: f.to,
        cc: f.cc,
        subject: f.subject,
        date: f.date,
        preview: f.preview,
        html: f.html,
        htmlNoImg: f.htmlNoImg,
        text: f.text,
        ai: f.ai,
      };
    } finally {
      lock.release();
    }
  });
}

export async function moveDraft(acc: MailAccount, uid: number): Promise<void> {
  await withClient(acc, async (client) => {
    const box = await draftsMailbox(client);
    const trash = await trashMailbox(client);
    const lock = await client.getMailboxLock(box);
    try {
      await client.messageMove(String(uid), trash, { uid: true });
    } finally {
      lock.release();
    }
  });
}

// --- Stats & liste INBOX ---

interface InboxStats {
  unseen: number;
  mutedUnseen: number;
  total: number;
  latest: InboxItem[];
}

interface EnvelopeMsg {
  uid: number;
  envelope?: { from?: { address?: string; name?: string }[]; subject?: string; date?: Date | string };
  flags?: Set<string>;
  bodyStructure?: unknown;
}

function envToItem(acc: MailAccount, msg: EnvelopeMsg): InboxItem {
  const env = msg.envelope;
  return {
    account: acc.id,
    uid: msg.uid,
    from: (env?.from ?? []).map((a) => a.name ?? a.address ?? "").filter(Boolean).join(", "),
    fromEmail: (env?.from?.[0]?.address ?? "").toLowerCase(),
    subject: env?.subject ?? "(sans sujet)",
    date: iso(env?.date),
    unread: !(msg.flags?.has("\\Seen") ?? false),
    hasAttachment: withAttachment(msg.bodyStructure),
  };
}

const FETCH_META = { envelope: true, flags: true, bodyStructure: true } as const;

async function inboxStatsOn(client: ImapFlow, acc: MailAccount, mutedSenders: string[] = []): Promise<InboxStats> {
  const lock = await client.getMailboxLock("INBOX");
  try {
    const status = await client.status("INBOX", { unseen: true, messages: true });
    const total: number = typeof status === "object" && status ? (status.messages ?? 0) : 0;
    const unseen: number = typeof status === "object" && status ? (status.unseen ?? 0) : 0;

    // Avec des expéditeurs bannis, un seul scan 1:* sert à la fois au décompte
    // des non-lus bannis ET à la fenêtre des 8 derniers — prise APRÈS filtrage
    // des bannis, sinon une page entière de bannis masquerait l'aperçu.
    // (IMAP SEARCH peu fiable chez OVH — cf. inboxEnvelopes. Coût : 1 fetch 1:*
    // par compte bannisseur à chaque overview (cache 60 s) et run cron.)
    if (mutedSenders.length > 0) {
      // 1re passe légère (enveloppes+flags seulement) : décompte des bannis
      // et uids des non-bannis — pas de bodyStructure sur toute la boîte.
      const light = { envelope: true, flags: true } as const;
      let mutedUnseen = 0;
      const visibleUids: number[] = [];
      for await (const msg of client.fetch("1:*", light, { uid: true })) {
        const from = (msg.envelope?.from?.[0]?.address ?? "").toLowerCase();
        const muted = mutedSenders.some((s) => sameSender(from, s));
        if (muted && !(msg.flags?.has("\\Seen") ?? false)) mutedUnseen++;
        if (!muted) visibleUids.push(msg.uid);
      }
      // 2e passe : bodyStructure (pièces jointes) seulement sur la fenêtre visible.
      const tailUids = visibleUids.slice(-8);
      const byUid = new Map<number, EnvelopeMsg>();
      if (tailUids.length > 0) {
        for await (const msg of client.fetch(tailUids.join(","), FETCH_META, { uid: true })) {
          byUid.set(msg.uid, msg as EnvelopeMsg);
        }
      }
      const latest = tailUids.map((u) => byUid.get(u) ?? ({ uid: u } as EnvelopeMsg)).reverse().map((m) => envToItem(acc, m));
      return { unseen, mutedUnseen, total, latest };
    }

    const latest: InboxItem[] = [];
    if (total > 0) {
      const range = `${Math.max(1, total - 7)}:*`;
      for await (const msg of client.fetch(range, FETCH_META, { uid: true })) {
        latest.unshift(envToItem(acc, msg));
      }
    }
    return { unseen, mutedUnseen: 0, total, latest };
  } finally {
    lock.release();
  }
}

export async function inboxStats(acc: MailAccount, mutedSenders: string[] = []): Promise<InboxStats> {
  return withClient(acc, (client) => inboxStatsOn(client, acc, mutedSenders));
}

// Stats INBOX + drafts en UNE connexion (économie Fluid : 1 TLS+auth au lieu de 2).
export async function fetchAccount(acc: MailAccount, mutedSenders: string[] = []): Promise<{ stats: InboxStats; drafts: DraftSummary[] }> {
  return withClient(acc, async (client) => ({
    stats: await inboxStatsOn(client, acc, mutedSenders),
    drafts: await listDraftsOn(client, acc),
  }));
}

export async function getMessage(acc: MailAccount, uid: number): Promise<InboxFull | null> {
  return withClient(acc, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const buf = await downloadRaw(client, uid);
      if (!buf) return null;
      const parsed: ParsedMail = await simpleParser(buf);
      const f = parseFull(parsed);
      return {
        account: acc.id,
        uid,
        from: f.from,
        fromEmail: f.fromEmail,
        to: f.to,
        subject: f.subject,
        date: f.date,
        unread: false,
        html: f.html,
        htmlNoImg: f.htmlNoImg,
        text: f.text,
        attachments: f.attachments,
        replyTo: f.replyTo,
        replyToEmail: f.replyToEmail,
        messageId: f.messageId,
        ai: f.ai,
      };
    } finally {
      lock.release();
    }
  });
}

// Télécharge une pièce jointe (index = position dans parsed.attachments).
export async function getAttachment(
  acc: MailAccount,
  uid: number,
  index: number,
): Promise<{ filename: string; contentType: string; content: Buffer } | null> {
  return withClient(acc, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const buf = await downloadRaw(client, uid);
      if (!buf) return null;
      const parsed: ParsedMail = await simpleParser(buf);
      const att = parsed.attachments?.[index];
      if (!att) return null;
      return {
        filename: att.filename ?? `piece-jointe-${index + 1}`,
        contentType: att.contentType ?? "application/octet-stream",
        content: att.content,
      };
    } finally {
      lock.release();
    }
  });
}

export async function deleteMessage(acc: MailAccount, uid: number): Promise<void> {
  await withClient(acc, async (client) => {
    const trash = await trashMailbox(client);
    const lock = await client.getMailboxLock("INBOX");
    try {
      await client.messageMove(String(uid), trash, { uid: true });
    } finally {
      lock.release();
    }
  });
}

async function listTrashOn(client: ImapFlow, acc: MailAccount): Promise<InboxItem[]> {
  const box = await trashMailbox(client);
  const lock = await client.getMailboxLock(box);
  try {
    const status = await client.status(box, { messages: true });
    const total: number = typeof status === "object" && status ? (status.messages ?? 0) : 0;
    const out: InboxItem[] = [];
    if (total > 0) {
      const range = `${Math.max(1, total - 29)}:*`;
      for await (const msg of client.fetch(range, FETCH_META, { uid: true })) {
        out.unshift(envToItem(acc, msg));
      }
    }
    return out;
  } finally {
    lock.release();
  }
}

export async function listTrash(acc: MailAccount): Promise<InboxItem[]> {
  return withClient(acc, (client) => listTrashOn(client, acc));
}

export async function restoreTrash(acc: MailAccount, uid: number): Promise<void> {
  await withClient(acc, async (client) => {
    const box = await trashMailbox(client);
    const lock = await client.getMailboxLock(box);
    try {
      await client.messageMove(String(uid), "INBOX", { uid: true });
    } finally {
      lock.release();
    }
  });
}

// Suppression définitive dans la corbeille (uid précis, ou toute la boîte sans uid).
export async function purgeTrash(acc: MailAccount, uid?: number): Promise<number> {
  return withClient(acc, async (client) => {
    const box = await trashMailbox(client);
    const lock = await client.getMailboxLock(box);
    try {
      if (Number.isInteger(uid)) {
        await client.messageDelete(String(uid), { uid: true });
        return 1;
      }
      const status = await client.status(box, { messages: true });
      const total: number = typeof status === "object" && status ? (status.messages ?? 0) : 0;
      if (total > 0) await client.messageDelete("1:*", { uid: false });
      return total;
    } finally {
      lock.release();
    }
  });
}

export async function deleteFromSender(acc: MailAccount, senderEmail: string): Promise<number> {
  return withClient(acc, async (client) => {
    const trash = await trashMailbox(client);
    const lock = await client.getMailboxLock("INBOX");
    try {
      const want = senderEmail.toLowerCase();
      const envs = await inboxEnvelopes(client);
      const uids = envs.filter((e) => sameSender(e.fromEmail, want)).map((e) => e.uid);
      if (uids.length > 0) {
        await client.messageMove(uids.join(","), trash, { uid: true });
      }
      return uids.length;
    } finally {
      lock.release();
    }
  });
}

// OVH IMAP SEARCH is unreliable (returns empty), so we filter envelopes client-side.
async function inboxEnvelopes(client: ImapFlow): Promise<{ uid: number; fromEmail: string; subject: string }[]> {
  const status = await client.status("INBOX", { messages: true });
  const total = typeof status === "object" && status ? (status.messages ?? 0) : 0;
  if (total === 0) return [];
  const out: { uid: number; fromEmail: string; subject: string }[] = [];
  for await (const m of client.fetch("1:*", { envelope: true }, { uid: true })) {
    out.push({
      uid: m.uid,
      fromEmail: (m.envelope?.from?.[0]?.address ?? "").toLowerCase(),
      subject: m.envelope?.subject ?? "",
    });
  }
  return out;
}

const stripRe = (s: string) => s.replace(/^((re|fwd?|tr)\s*:\s*)+/i, "").trim().toLowerCase();

export async function findOriginalMessage(acc: MailAccount, toAddr: string, subject: string): Promise<InboxFull | null> {
  const want = stripRe(subject);
  // "Jean Dupont <jean@x.fr>" → "jean@x.fr" (match exact contre l'expéditeur).
  const wantFrom = extractAddress(toAddr.split(",")[0] ?? "");
  return withClient(acc, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const envs = await inboxEnvelopes(client);
      let bestUid: number | null = null;
      for (const e of envs) {
        const subjMatch = stripRe(e.subject) === want;
        const fromMatch = wantFrom && sameSender(e.fromEmail, wantFrom);
        if (subjMatch && fromMatch) bestUid = e.uid;
      }
      if (bestUid === null) {
        for (const e of envs) if (stripRe(e.subject) === want) bestUid = e.uid;
      }
      if (bestUid === null) return null;
      const buf = await downloadRaw(client, bestUid);
      if (!buf) return null;
      const parsed: ParsedMail = await simpleParser(buf);
      const f = parseFull(parsed);
      return {
        account: acc.id,
        uid: bestUid,
        from: f.from,
        fromEmail: f.fromEmail,
        to: f.to,
        subject: f.subject,
        date: f.date,
        unread: false,
        html: f.html,
        htmlNoImg: f.htmlNoImg,
        text: f.text,
        attachments: f.attachments,
        replyTo: f.replyTo,
        replyToEmail: f.replyToEmail,
        messageId: f.messageId,
        ai: f.ai,
      };
    } finally {
      lock.release();
    }
  });
}

export async function clearDraftsToTrash(acc: MailAccount, uids: number[]): Promise<number> {
  if (uids.length === 0) return 0;
  return withClient(acc, async (client) => {
    const box = await draftsMailbox(client);
    const trash = await trashMailbox(client);
    const lock = await client.getMailboxLock(box);
    try {
      let moved = 0;
      for (const uid of uids) {
        try {
          await client.messageMove(String(uid), trash, { uid: true });
          moved++;
        } catch { /* skip missing */ }
      }
      return moved;
    } finally {
      lock.release();
    }
  });
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
export const cleanHeaderValue = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

/** Adresse d'un segment d'en-tête : "Jean Dupont <jean@x.fr>" → "jean@x.fr". */
export function extractAddress(v: string): string {
  const s = cleanHeaderValue(v);
  const lt = s.lastIndexOf("<");
  const gt = s.lastIndexOf(">");
  const inner = lt >= 0 && gt > lt ? s.slice(lt + 1, gt).trim() : s.trim();
  return inner.toLowerCase();
}

/**
 * Toutes les adresses valides d'un en-tête To/Cc (listes multi-destinataires
 * comprises). Les segments invalides sont ignorés ; jette si aucun valide —
 * jamais de CRLF (cleanHeaderValue les neutralise avant).
 */
export function headerAddresses(v: string): string[] {
  const out = cleanHeaderValue(v)
    .split(",")
    .map(extractAddress)
    .filter((a) => EMAIL_RE.test(a));
  if (out.length === 0) throw new Error("destinataire invalide");
  return out;
}

/**
 * Crée un brouillon de réponse via MailComposer (nodemailer) : encodage
 * RFC 2047 des en-têtes non-ASCII, CRLF neutralisés, To/Reply-To validés —
 * un sujet de mail reçu ne peut plus injecter d'en-têtes (Cc caché, From…).
 */
export async function createReplyDraft(
  acc: MailAccount,
  opts: { to: string; replyTo?: string; subject: string; body: string; inReplyTo?: string; references?: string; ai?: boolean },
): Promise<void> {
  // Reply-To (si valide) a priorité sur From — réponses aux listes/noreply.
  // Tous les destinataires valides sont conservés (To multi-adresses).
  // Si le Reply-To est entièrement invalide, on retombe sur To plutôt que 500.
  let to: string;
  if (opts.replyTo) {
    try {
      to = headerAddresses(opts.replyTo).join(", ");
    } catch {
      to = headerAddresses(opts.to).join(", ");
    }
  } else {
    to = headerAddresses(opts.to).join(", ");
  }
  const subject = cleanHeaderValue(opts.subject);
  const re = /^re:/i.test(subject) ? subject : `Re: ${subject}`;
  const msgId = opts.inReplyTo ? cleanHeaderValue(opts.inReplyTo) : undefined;
  const mail = new MailComposer({
    from: acc.smtp.from ?? acc.smtp.user,
    to,
    subject: re,
    text: opts.body,
    inReplyTo: msgId,
    references: opts.references ?? msgId,
    headers: opts.ai ? { "X-Mail-Quest": "ai" } : {},
  });
  const raw = await new Promise<Buffer>((resolve, reject) => {
    mail.compile().build((err: Error | null, message: Buffer) => (err ? reject(err) : resolve(message)));
  });
  await withClient(acc, async (client) => {
    const box = await draftsMailbox(client);
    await client.append(box, raw, ["\\Draft"]);
  });
}
