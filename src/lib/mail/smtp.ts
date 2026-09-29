import nodemailer from "nodemailer";
import type { MailAccount } from "./accounts";
import { getDraft, moveDraft } from "./imap";

export async function sendDraft(acc: MailAccount, mailbox: string, uid: number): Promise<{ to: string; subject: string }> {
  const draft = await getDraft(acc, mailbox, uid);
  if (!draft) throw new Error("Draft not found");
  if (!draft.to.trim()) throw new Error("Draft has no recipient");

  const transport = nodemailer.createTransport({
    host: acc.smtp.host,
    port: acc.smtp.port,
    secure: acc.smtp.secure,
    auth: { user: acc.smtp.user, pass: acc.smtp.password },
  });
  await transport.sendMail({
    from: acc.smtp.from,
    to: draft.to,
    cc: draft.cc || undefined,
    subject: draft.subject,
    text: draft.text ?? undefined,
    html: draft.html ?? undefined,
  });
  await moveDraft(acc, mailbox, uid);
  return { to: draft.to, subject: draft.subject };
}
