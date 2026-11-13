/* Frugal Center service worker: web push only. */
self.addEventListener("push", (event) => {
  let data = { title: "Frugal Center", body: "A business you follow posted a new deal.", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/logo-mark.svg",
      badge: "/logo-mark.svg",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url.href);
          return c.focus();
        }
      }
      return clients.openWindow(url.href);
    }),
  );
});
