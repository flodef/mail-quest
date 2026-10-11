// Matrice d'accès du proxy (src/proxy.ts) — extraite pour être testable.

// Routes API publiques par nature : elles se protègent elles-mêmes
// (/api/auth rate-limité ; /api/cron et /api/reminders exigent Bearer CRON_SECRET).
// Comparaison exacte ou par sous-chemin — un futur "/api/cronXYZ" ne sera
// jamais public par accident.
export const PUBLIC_API = ["/api/auth", "/api/cron", "/api/reminders"];

// Assets publics (chemins exacts) + préfixes d'assets.
export const PUBLIC_EXACT = [
  "/login",
  "/manifest.webmanifest",
  "/sw.js",
  "/icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
];
export const PUBLIC_ASSET_PREFIXES = ["/_next/"];

// Jeton bot (OpenClaw) : lecture/ajout uniquement — jamais de modification/destruction.
export const BOT_PREFIXES = ["/api/tasks", "/api/notes"];
export const BOT_METHODS = new Set(["GET", "POST"]);

const underPrefix = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export const isPublicApi = (path: string) => PUBLIC_API.some((p) => underPrefix(path, p));
export const isPublicAsset = (path: string) =>
  PUBLIC_EXACT.includes(path) || PUBLIC_ASSET_PREFIXES.some((p) => path.startsWith(p));
export const isBotRoute = (method: string, path: string) =>
  BOT_METHODS.has(method) && BOT_PREFIXES.some((p) => underPrefix(path, p));

// Méthodes mutantes soumises au garde CSRF (fetch metadata).
export const isMutating = (method: string) => !["GET", "HEAD", "OPTIONS"].includes(method);

/**
 * Préfixe /64 d'une adresse IPv6 — pour le bucketing du rate-limit login.
 * `::` est expansé AVANT de prendre les 4 premiers hextets : sans ça,
 * "2001:db8::1" et "2001:db8::2" donneraient des buckets différents alors
 * qu'ils partagent le même /64 (et la rotation resterait possible).
 * IPv4-mapped (::ffff:1.2.3.4) retombe sur l'IPv4.
 */
export function ipv6Prefix64(ip: string): string {
  const mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (mapped) return mapped[1];
  // Forme hexadécimale : ::ffff:0102:0304 = 1.2.3.4
  const hexMapped = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hexMapped) {
    const b = hexMapped.slice(1).flatMap((h) => { const n = parseInt(h, 16); return [n >> 8, n & 0xff]; });
    return b.join(".");
  }
  const [left, right = ""] = ip.split("::");
  const leftGroups = left.split(":").filter(Boolean);
  const rightGroups = right.split(":").filter(Boolean);
  const groups =
    leftGroups.length + rightGroups.length <= 8 && ip.includes("::")
      ? [...leftGroups, ...Array(Math.max(0, 8 - leftGroups.length - rightGroups.length)).fill("0"), ...rightGroups]
      : [...leftGroups, ...rightGroups];
  // Normalisation des hextets : "0db8" === "db8" — sinon la rotation via
  // formes non compressées recréerait des buckets distincts.
  const hex = (g: string) => (parseInt(g, 16) || 0).toString(16);
  return `${groups.slice(0, 4).map(hex).join(":")}::/64`;
}
