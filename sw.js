// Service Worker — Vitali PWA
// Version: 1.24.0

const CACHE_NAME = "vitali-v24";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap"
];

// ─── INSTALL: cache core assets ───
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Caching app shell");
        return cache.addAll(ASSETS.map(url => {
          // Skip cross-origin font requests during install (cache on fetch)
          if (url.startsWith("http")) return new Request(url, { mode: "no-cors" });
          return url;
        }));
      })
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE: clean old caches ───
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log("[SW] Removing old cache:", key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH: cache-first for app shell, network-first for everything else ───
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle http/https
  if (!request.url.startsWith("http")) return;

  // For navigation requests (HTML pages) — network first, fallback to cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache fresh copy
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // For same-origin assets — cache first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // For Google Fonts and other cross-origin — stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request, { mode: "no-cors" }).then((response) => {
        if (response) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => null);

      return cached || networkFetch;
    })
  );
});

// ─── MESSAGE: force update + show notification ───
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data.type === "SHOW_NOTIFICATION") {
    const { title = "Vitali", body = "" } = event.data;
    self.registration.showNotification(title, {
      body,
      icon:  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E%3Crect width='192' height='192' rx='40' fill='%234CAF50'/%3E%3Ctext x='96' y='130' font-size='100' text-anchor='middle'%3E%F0%9F%8C%BF%3C/text%3E%3C/svg%3E",
      badge: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='20' fill='%234CAF50'/%3E%3Ctext x='48' y='65' font-size='50' text-anchor='middle'%3E%F0%9F%8C%BF%3C/text%3E%3C/svg%3E",
      vibrate: [200, 100, 200],
      tag: "vitali-reminder",
      renotify: true,
      data: { url: self.registration.scope }
    });
  }
});

// ─── NOTIFICATION CLICK: odpri aplikacijo ───
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(self.registration.scope);
      }
    })
  );
});
