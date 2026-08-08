const CACHE_NAME = "insurance-forms-comparator-v2.1.0";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./parser.js",
  "./compare.js",
  "./app.js",
  "./insurance-forms-comparator-offline.html",
  "./manifest.json",
  "./icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const request = event.request;
  const acceptsHtml = request.headers.get("accept")?.includes("text/html");
  
  const isCoreAsset = ASSETS.some((asset) => {
    const clean = asset.replace("./", "");
    return request.url.endsWith(clean) || request.url.endsWith("/") || request.url.includes("/forms-checker-offline/");
  });
  
  if (acceptsHtml || isCoreAsset) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
