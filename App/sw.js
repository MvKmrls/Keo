// Service worker : met l'app en cache pour l'ouvrir sans réseau.
// Incrémenter VERSION à chaque publication pour forcer la mise à jour.
const VERSION = "uss-v0.1.0";
const ASSETS = [
  "./", "./index.html", "./manifest.webmanifest",
  "./css/theme.css", "./css/app.css",
  "./js/app.js", "./js/store.js", "./js/config.js", "./js/demo-data.js",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-180.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Réseau d'abord pour nos fichiers (on veut les mises à jour), cache en secours.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
  );
});
