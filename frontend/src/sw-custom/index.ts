declare const self: ServiceWorkerGlobalScope;

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string; link?: string };
  try {
    payload = event.data.json() as { title?: string; body?: string; link?: string };
  } catch {
    payload = { title: "Club Connect", body: event.data.text(), link: "/notifications" };
  }

  const title = payload.title ?? "Club Connect";
  const body  = payload.body  ?? "";
  const link  = payload.link  ?? "/notifications";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "club-connect-notification",
      renotify: true,
      data: { link },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link: string = (event.notification.data as { link?: string }).link ?? "/notifications";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            void (client as WindowClient).navigate(link);
            return client.focus();
          }
        }
        return self.clients.openWindow(link);
      })
  );
});
