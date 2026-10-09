import nodemailer from "nodemailer";
import type { MailAccount } from "./accounts";
import { getDraft, moveDraft } from "./imap";

export async function sendMail(acc: MailAccount, opts: { to: string; subject: string; text?: string; html?: string; cc?: string }): Promise<void> {
  const transport = nodemailer.createTransport({
    host: acc.smtp.host,
    port: acc.smtp.port,
    secure: acc.smtp.secure,
    auth: { user: acc.smtp.user, pass: acc.smtp.password },
  });
  await transport.sendMail({
    from: acc.smtp.from,
    to: opts.to,
    cc: opts.cc || undefined,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}

/**
 * Envoie le brouillon puis le déplace à la corbeille. `moved=false` signale
 * que le mail est parti mais que le brouillon n'a pas pu être déplacé — le
 * client avertit au lieu de renvoyer en boucle.
 */
export async function sendDraft(acc: MailAccount, uid: number): Promise<{ to: string; subject: string; moved: boolean }> {
  const draft = await getDraft(acc, uid);
  if (!draft) throw new Error("Draft not found");
  if (!draft.to.trim()) throw new Error("Draft has no recipient");

  await sendMail(acc, {
    to: draft.to,
    cc: draft.cc || undefined,
    subject: draft.subject,
    text: draft.text ?? undefined,
    html: draft.html ?? undefined,
  });
  const moved = await moveDraft(acc, uid).then(() => true, () => false);
  return { to: draft.to, subject: draft.subject, moved };
}
