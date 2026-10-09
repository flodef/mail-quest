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
