// Service worker minimal pour la consultation hors-ligne.
// Stratégie :
//  - Navigation (pages HTML) : réseau d'abord, repli sur le cache (puis "/").
//  - Autres requêtes GET same-origin (JS, CSS, données, icônes) : cache d'abord,
//    mise à jour en arrière-plan (stale-while-revalidate).

const CACHE = "pcg-syscohada-v2";

// Racine réelle du site, déduite de l'emplacement du service worker lui-même.
// Vaut "/" sur un domaine propre et "/plan-comptable-syscohada/" sur GitHub
// Pages. Les chemins étaient auparavant écrits en dur à la racine : sous un
// sous-chemin, le pré-cache tombait sur des 404 et la consultation hors ligne,
// qui est la raison d'être de cette application, ne fonctionnait pas.
const BASE = new URL("./", self.location).pathname;

// Barre oblique finale obligatoire : l'export génère un dossier par route.
const PRECACHE = [
  BASE,
  `${BASE}classes/`,
  `${BASE}ecritures/`,
  `${BASE}manifest.webmanifest`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pages : réseau d'abord pour avoir la dernière version, repli cache.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(BASE))
        )
    );
    return;
  }

  // Assets/données : cache d'abord, revalidation en arrière-plan.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
