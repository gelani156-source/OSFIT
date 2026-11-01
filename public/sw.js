// OSFIT isolated offline cache. Do not affect LIFT or other sites on github.io.
const CACHE = 'osfit-shell-v4-20261101';
const PREFIX = 'osfit-';
const SCOPE = new URL(self.registration.scope);
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(new Request(request, {cache:'no-cache'})).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone())).catch(()=>{});
      return response;
    }).catch(async () => (await caches.match(request)) || Response.error()));
    return;
  }
  event.respondWith(caches.match(request).then(async cached => {
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) caches.open(CACHE).then(cache => cache.put(request,response.clone())).catch(()=>{});
    return response;
  }));
});
