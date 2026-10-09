/*
 * Service worker da versão web: guarda os arquivos do app para abrir sem
 * internet. Os dados de maré NÃO passam por aqui (o app guarda o ano inteiro
 * no localStorage); pedidos ao Apps Script vão sempre direto para a rede.
 * Ao mudar qualquer arquivo do app, suba a VERSAO abaixo.
 */
const VERSAO = 'mares-web-1.1.1';
const ARQUIVOS = ['./', 'index.html', 'app.js', 'manifest.webmanifest', 'litoral.json', 'coordenadas_portos.json',
  'icone-192.png', 'icone-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// arquivos do app: rede primeiro (pega versão nova), cache se estiver sem internet
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copia = r.clone(); caches.open(VERSAO).then((c) => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
