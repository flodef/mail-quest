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

// Pass-through : requis par certains navigateurs pour rendre l'app installable
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
