// Minimal service worker (Feature 7 — installable PWA).
//
// Deliberately does no offline caching or push notifications — the plan
// asked for a simple installable PWA only. A registered service worker with
// a fetch handler is still what most browsers require before they'll show
// the "Install app" / "Add to Home Screen" prompt, so this exists purely to
// satisfy that requirement.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass every request straight through to the network — no caching.
  event.respondWith(fetch(event.request));
});
