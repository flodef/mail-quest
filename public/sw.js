const SHELL_CACHE = "mq-shell-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Mail Quest", {
      body: data.body ?? "",
      icon: data.icon ?? "/icon-192.png",
      badge: "/icon-192.png",
      tag: "mail-quest",
      renotify: true,
      data: { url: "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? "/"));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Les mutations sont gérées par l'outbox localStorage de la page.
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Navigation : réseau d'abord, shell en cache si hors-ligne.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) {
            const clone = r.clone();
            caches.open(SHELL_CACHE).then((c) => c.put("/", clone));
          }
          return r;
        })
        .catch(() => caches.match("/").then((hit) => hit ?? Response.error())),
    );
    return;
  }

  // Assets immutables (chunks hashés Next.js) + icônes : cache d'abord.
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icon") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((r) => {
            if (r.ok) {
              const clone = r.clone();
              caches.open(SHELL_CACHE).then((c) => c.put(req, clone));
            }
            return r;
          }),
      ),
    );
  }
});
