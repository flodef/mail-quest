// Mode hors-ligne : snapshot localStorage des dernières données connues +
// outbox des mutations à rejouer au retour du réseau. Client-side only.

export type Op = { url: string; init: RequestInit };

const CACHE_KEY = "mq-cache";
const OUTBOX_KEY = "mq-outbox";

export function saveSnapshot(data: object) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch { /* quota/SSR */ }
}

export function loadSnapshot<T>(): T | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
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

// Rejoue la file dans l'ordre. 4xx = op invalide → jetée. Réseau ou 5xx =
// on s'arrête et on garde le reste pour la prochaine tentative.
export async function flushOps(): Promise<number> {
  const ops = pendingOps();
  const rest: Op[] = [];
  let broken = false;
  for (const op of ops) {
    if (broken) {
      rest.push(op);
      continue;
    }
    try {
      const r = await fetch(op.url, op.init);
      if (r.ok) continue;
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
  return rest.length;
}
