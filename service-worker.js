const CACHE = "fimathe-shell-v1";
const SHELL = ["./", "./index.html", "./style.css", "./app.js", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Só cacheia o "casco" do app (HTML/CSS/JS/ícones). Chamadas às APIs de
// mercado (Binance / Twelve Data) sempre vão direto pra rede — nunca cache
// de preço, pra não mostrar cotação velha como se fosse atual.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const isMarketApi = url.hostname.includes("binance.com") || url.hostname.includes("twelvedata.com");
  if (isMarketApi) return; // deixa passar direto pra rede
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
