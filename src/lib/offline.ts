// Mode hors-ligne : snapshot localStorage des dernières données connues +
// outbox des mutations à rejouer au retour du réseau. Client-side only.

export type Op = { url: string; init: RequestInit };

const CACHE_KEY = "mq-cache";
const OUTBOX_KEY = "mq-outbox";
// Bump si le shape du snapshot change — un vieux snapshot est ignoré.
const SNAP_VERSION = 2;

export function saveSnapshot(data: object) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ v: SNAP_VERSION, data }));
  } catch { /* quota/SSR */ }
}

export function loadSnapshot<T>(): T | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as { v?: number; data?: T };
    return obj.v === SNAP_VERSION && obj.data !== undefined ? (obj.data as T) : null;
  } catch {
    return null;
  }
}

export function pendingOps(): Op[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]") as Op[];
  } catch {
    return [];
  }
}

function writeOps(ops: Op[]) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops));
  } catch { /* noop */ }
}

export function enqueueOp(op: Op): number {
  const ops = [...pendingOps(), op];
  writeOps(ops);
  return ops.length;
}

// Rejoue la file dans l'ordre.
// - 401/403 : session morte → on CONSERVE les ops (elles marcheront après
//   re-login) et on le signale — jamais de drop silencieux.
// - 5xx/réseau : on s'arrête et on garde le reste pour la prochaine tentative.
// - Autres 4xx : op invalide qui ne réussira jamais → jetée.
export async function flushOps(): Promise<{ remaining: number; authLost: boolean }> {
  const ops = pendingOps();
  const rest: Op[] = [];
  let broken = false;
  let authLost = false;
  for (const op of ops) {
    if (broken) {
      rest.push(op);
      continue;
    }
    try {
      const r = await fetch(op.url, op.init);
      if (r.ok) continue;
      if (r.status === 401 || r.status === 403) {
        authLost = true;
        broken = true;
        rest.push(op);
        continue;
      }
      if (r.status >= 500) {
        broken = true;
        rest.push(op);
      }
    } catch {
      broken = true;
      rest.push(op);
    }
  }
  writeOps(rest);
  return { remaining: rest.length, authLost };
}
