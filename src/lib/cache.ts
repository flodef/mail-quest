// Cache mémoire courte durée pour les routes IMAP coûteuses (Fluid compute :
// l'instance reste chaude entre requêtes, le cache survit aux invocations).
// Toute route qui MUTE l'état mail doit appeler invalidateMail().

const store = new Map<string, { at: number; data: unknown }>();

export async function cachedMail<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  const data = await fn();
  store.set(key, { at: Date.now(), data });
  return data;
}

export function invalidateMail() {
  store.clear();
}
