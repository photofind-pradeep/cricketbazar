// CricketBazar Service Worker
// Handles: offline caching, auto-updates, push notifications

const CACHE_NAME = "cricketbazar-v1";
const CACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// ── INSTALL: cache core files ──────────────────────────────────────
self.addEventListener("install", (event) => {
  console.log("[CricketBazar SW] Installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_URLS);
    })
  );
  // Take control immediately — don't wait for old SW to die
  self.skipWaiting();
});

// ── ACTIVATE: clean old caches ────────────────────────────────────
self.addEventListener("activate", (event) => {
  console.log("[CricketBazar SW] Activated — clearing old caches");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// ── FETCH: network first, fallback to cache ────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls (live scores) — always network, never cache
  if (
    url.hostname.includes("cricbuzz-live") ||
    url.hostname.includes("supabase") ||
    url.hostname.includes("razorpay")
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // App shell — network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache fresh copy
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, clone);
        });
        return response;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(request).then((cached) => {
          return cached || caches.match("/index.html");
        });
      })
  );
});

// ── MESSAGE: force update from app ───────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ── PUSH NOTIFICATIONS (future use) ──────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  const options = {
    body: data.body || "Match update!",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200, 100, 200],
    data: { url: data.url || "/" },
  };
  event.waitUntil(
    self.registration.showNotification(
      data.title || "CricketBazar 🏏",
      options
    )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || "/")
  );
});
