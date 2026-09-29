import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import type { MailAccount } from "./accounts";

export interface DraftSummary {
  account: string;
  mailbox: string;
  uid: number;
  to: string;
  subject: string;
  date: string | null;
  preview: string;
}

export interface DraftFull extends DraftSummary {
  html: string | null;
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
}

export interface InboxFull extends InboxItem {
  to: string;
  html: string | null;
  text: string | null;
}

async function withClient<T>(acc: MailAccount, fn: (c: ImapFlow) => Promise<T>): Promise<T> {
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
    return await fn(client);
  } finally {
    try { await client.logout(); } catch { /* noop */ }
  }
}

function iso(d: string | Date | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : d;
}

async function findMailbox(client: ImapFlow, special: string, fallbacks: string[]): Promise<string | null> {
  const all = await client.list();
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

export async function listDrafts(acc: MailAccount): Promise<DraftSummary[]> {
  return withClient(acc, async (client) => {
    const box = await draftsMailbox(client);
    const lock = await client.getMailboxLock(box);
    try {
      const out: DraftSummary[] = [];
      for await (const msg of client.fetch("1:*", { envelope: true }, { uid: true })) {
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
        });
      }
      return out;
    } finally {
      lock.release();
    }
  });
}

export async function getDraft(acc: MailAccount, mailbox: string, uid: number): Promise<DraftFull | null> {
  return withClient(acc, async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const raw = await client.download(String(uid), undefined, { uid: true });
      if (!raw?.content) return null;
      const buf = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        raw.content!.on("data", (c: Buffer) => chunks.push(c));
        raw.content!.on("end", () => resolve(Buffer.concat(chunks)));
        raw.content!.on("error", reject);
      });
      const parsed: ParsedMail = await simpleParser(buf);
      const addr = (v: ParsedMail["to"]) =>
        v ? (Array.isArray(v) ? v : [v]).flatMap((t) => t.value.map((a) => a.address ?? "")).join(", ") : "";
      const to = addr(parsed.to);
      const cc = addr(parsed.cc);
      return {
        account: acc.id,
        mailbox,
        uid,
        to,
        cc,
        subject: parsed.subject ?? "(sans sujet)",
        date: iso(parsed.date),
        preview: (parsed.text ?? "").replace(/\s+/g, " ").slice(0, 140),
        html: typeof parsed.html === "string" ? parsed.html : null,
        text: parsed.text ?? null,
      };
    } finally {
      lock.release();
    }
  });
}

export async function moveDraft(acc: MailAccount, mailbox: string, uid: number): Promise<void> {
  await withClient(acc, async (client) => {
    const trash = await trashMailbox(client);
    const lock = await client.getMailboxLock(mailbox);
    try {
      await client.messageMove(String(uid), trash, { uid: true });
    } finally {
      lock.release();
    }
  });
}

export async function inboxStats(acc: MailAccount): Promise<{ unseen: number; total: number; latest: InboxItem[] }> {
  return withClient(acc, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const status = await client.status("INBOX", { unseen: true, messages: true });
      const latest: InboxItem[] = [];
      const total: number = typeof status === "object" && status ? (status.messages ?? 0) : 0;
      if (total > 0) {
        const range = `${Math.max(1, total - 7)}:*`;
        for await (const msg of client.fetch(range, { envelope: true, flags: true }, { uid: true })) {
          const env = msg.envelope;
          latest.unshift({
            account: acc.id,
            uid: msg.uid,
            from: (env?.from ?? []).map((a) => a.name ?? a.address ?? "").filter(Boolean).join(", "),
            fromEmail: (env?.from ?? []).map((a) => a.address ?? "").filter(Boolean).join(", ").toLowerCase(),
            subject: env?.subject ?? "(sans sujet)",
            date: iso(env?.date),
            unread: !(msg.flags?.has("\\Seen") ?? false),
          });
        }
      }
      return { unseen: typeof status === "object" && status ? (status.unseen ?? 0) : 0, total, latest };
    } finally {
      lock.release();
    }
  });
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

export async function getMessage(acc: MailAccount, uid: number): Promise<InboxFull | null> {
  return withClient(acc, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const buf = await downloadRaw(client, uid);
      if (!buf) return null;
      const parsed: ParsedMail = await simpleParser(buf);
      const addr = (v: ParsedMail["to"]) =>
        v ? (Array.isArray(v) ? v : [v]).flatMap((t) => t.value.map((a) => a.address ?? "")).join(", ") : "";
      return {
        account: acc.id,
        uid,
        from: addr(parsed.from) || (parsed.from?.text ?? ""),
        fromEmail: addr(parsed.from).toLowerCase(),
        to: addr(parsed.to),
        subject: parsed.subject ?? "(sans sujet)",
        date: iso(parsed.date),
        unread: false,
        html: typeof parsed.html === "string" ? parsed.html : null,
        text: parsed.text ?? null,
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

export async function deleteFromSender(acc: MailAccount, senderEmail: string): Promise<number> {
  return withClient(acc, async (client) => {
    const trash = await trashMailbox(client);
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await client.search({ from: senderEmail }, { uid: true });
      const list = Array.isArray(uids) ? uids : [];
      if (list.length > 0) {
        await client.messageMove(list.join(","), trash, { uid: true });
      }
      return list.length;
    } finally {
      lock.release();
    }
  });
}

export async function createReplyDraft(acc: MailAccount, to: string, subject: string, body: string, inReplyTo?: string): Promise<void> {
  await withClient(acc, async (client) => {
    const box = await draftsMailbox(client);
    const re = /^re:/i.test(subject) ? subject : `Re: ${subject}`;
    const headers = [
      `From: ${acc.smtp.from}`,
      `To: ${to}`,
      `Subject: ${re}`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=utf-8`,
      ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`, `References: ${inReplyTo}`] : []),
    ];
    const raw = headers.join("\r\n") + "\r\n\r\n" + body.replace(/\n/g, "\r\n");
    await client.append(box, raw, ["\\Draft"]);
  });
}
