export function serviceWorkerSource(assets: readonly string[], version: string): string {
  return `/* POS-Zanna app assets only. Business data stays in IndexedDB. */
const VERSION = ${JSON.stringify(version)};
const CACHE = 'pos-zanna-app-' + VERSION;
const ASSETS = ${JSON.stringify(assets)};
const PATHS = new Set(ASSETS);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(path => new Request(path, { cache: 'reload' })))).catch(async error => { await caches.delete(CACHE); throw error; }));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('pos-zanna-app-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate' && !url.pathname.startsWith('/api/')) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match('/index.html')).then(response => response || fetch(event.request)));
  } else if (PATHS.has(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(response => response || fetch(event.request)));
  }
});
self.addEventListener('message', event => {
  const reply = value => event.ports[0]?.postMessage(value);
  if (event.data?.type === 'APP_STATUS') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const ready = (await Promise.all(ASSETS.map(path => cache.match(path)))).every(Boolean);
      reply({ ready, version: VERSION, count: (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).length });
    })());
  }
  if (event.data?.type === 'ACTIVATE_UPDATE') {
    event.waitUntil((async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (clients.length !== 1 || !event.source || clients[0].id !== event.source.id) { reply({ accepted: false }); return; }
      reply({ accepted: true }); await self.skipWaiting();
    })());
  }
});
`
}
