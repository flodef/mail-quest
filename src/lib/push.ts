import webpush from "web-push";
import { listPushSubs } from "./db";

let configured = false;
function ensureVapid() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:flo@fims.fi",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

export async function notifyAll(title: string, body: string): Promise<void> {
  ensureVapid();
  const subs = await listPushSubs();
  await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: s.keys },
        JSON.stringify({ title, body, icon: "/icon-192.png" }),
      ),
    ),
  );
}
