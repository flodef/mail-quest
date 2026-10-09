import { NextResponse } from "next/server";
import { getAccounts } from "@/lib/mail/accounts";
import { inboxStats } from "@/lib/mail/imap";
import { dbReady, getLastSeen, listMuted, setLastSeen, initDb } from "@/lib/db";
import { notifyAll } from "@/lib/push";
import { checkReminders } from "@/lib/reminders";
import { checkCronAuth } from "@/lib/auth";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = checkCronAuth(req);
  if (!auth.ok) return jsonError(auth.status, auth.error);
  if (!dbReady()) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  }
  await initDb();
  const mutedRows = await listMuted().catch(() => []);
  const muted = new Set(mutedRows.map((m) => `${m.account}:${m.sender}`));
  const mutedFor = (id: string) => mutedRows.filter((m) => m.account === id).map((m) => m.sender);
  const events: string[] = [];
  for (const acc of getAccounts()) {
    try {
      const stats = await inboxStats(acc, mutedFor(acc.id));
      const unseen = Math.max(0, stats.unseen - stats.mutedUnseen);
      const prev = await getLastSeen(acc.id);
      const newest = stats.latest.find((m) => m.unread && !muted.has(`${acc.id}:${m.fromEmail}`));
      // Notifie même si le plus récent non-banni sort de la fenêtre des 8 derniers
      // messages — sinon une pile de non-lus passe sous silence.
      if (prev !== null && unseen > prev) {
        events.push(`${acc.label}: ${unseen - prev} nouveau(x)`);
        await notifyAll(`📬 ${acc.label}`, newest ? `De: ${newest.from}\n${newest.subject}` : `${unseen - prev} nouveau(x) non lu(s)`, acc.id);
      }
      await setLastSeen(acc.id, unseen);
    } catch (e) {
      events.push(`${acc.id}: error ${e instanceof Error ? e.message : e}`);
    }
  }
  try {
    const sent = await checkReminders(true);
    if (sent > 0) events.push(`rappels agenda: ${sent}`);
  } catch (e) {
    events.push(`reminders: error ${e instanceof Error ? e.message : e}`);
  }
  return NextResponse.json({ ok: true, events });
}
