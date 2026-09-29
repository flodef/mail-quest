import { neon } from "@neondatabase/serverless";

export function dbReady(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL env var missing");
  return neon(url);
}

let inited = false;

export async function initDb(): Promise<void> {
  const q = sql();
  await q`CREATE TABLE IF NOT EXISTS push_subs (
    endpoint TEXT PRIMARY KEY,
    keys JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS asides (
    account TEXT NOT NULL,
    uid INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (account, uid)
  )`;
  await q`CREATE TABLE IF NOT EXISTS last_seen (
    account TEXT PRIMARY KEY,
    unseen INTEGER NOT NULL,
    checked_at TIMESTAMPTZ DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS muted_senders (
    account TEXT NOT NULL,
    sender TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (account, sender)
  )`;
  inited = true;
}

async function ensureDb(): Promise<void> {
  if (!inited) await initDb();
}

export async function addAside(account: string, uid: number): Promise<void> {
  await sql()`INSERT INTO asides (account, uid) VALUES (${account}, ${uid}) ON CONFLICT DO NOTHING`;
}

export async function removeAside(account: string, uid: number): Promise<void> {
  await sql()`DELETE FROM asides WHERE account=${account} AND uid=${uid}`;
}

export async function listAsides(): Promise<{ account: string; uid: number }[]> {
  await ensureDb();
  const rows = await sql()`SELECT account, uid FROM asides`;
  return rows as unknown as { account: string; uid: number }[];
}

export async function addMuted(account: string, sender: string): Promise<void> {
  await ensureDb();
  await sql()`INSERT INTO muted_senders (account, sender) VALUES (${account}, ${sender.toLowerCase()}) ON CONFLICT DO NOTHING`;
}

export async function removeMuted(account: string, sender: string): Promise<void> {
  await ensureDb();
  await sql()`DELETE FROM muted_senders WHERE account=${account} AND sender=${sender.toLowerCase()}`;
}

export async function listMuted(): Promise<{ account: string; sender: string }[]> {
  await ensureDb();
  const rows = await sql()`SELECT account, sender FROM muted_senders`;
  return rows as unknown as { account: string; sender: string }[];
}

export async function addPushSub(endpoint: string, keys: unknown): Promise<void> {
  await sql()`INSERT INTO push_subs (endpoint, keys) VALUES (${endpoint}, ${JSON.stringify(keys)}::jsonb) ON CONFLICT (endpoint) DO UPDATE SET keys=EXCLUDED.keys`;
}

export async function removePushSub(endpoint: string): Promise<void> {
  await sql()`DELETE FROM push_subs WHERE endpoint=${endpoint}`;
}

export async function listPushSubs(): Promise<{ endpoint: string; keys: { p256dh: string; auth: string } }[]> {
  const rows = await sql()`SELECT endpoint, keys FROM push_subs`;
  return rows as unknown as { endpoint: string; keys: { p256dh: string; auth: string } }[];
}

export async function getLastSeen(account: string): Promise<number | null> {
  const rows = (await sql()`SELECT unseen FROM last_seen WHERE account=${account}`) as { unseen: number }[];
  return rows[0]?.unseen ?? null;
}

export async function setLastSeen(account: string, unseen: number): Promise<void> {
  await sql()`INSERT INTO last_seen (account, unseen, checked_at) VALUES (${account}, ${unseen}, now())
    ON CONFLICT (account) DO UPDATE SET unseen=EXCLUDED.unseen, checked_at=now()`;
}
