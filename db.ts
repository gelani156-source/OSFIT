const CACHE='osfit-shell-v2.0.0';
self.addEventListener('install',e=>{e.waitUntil(self.skipWaiting())});
self.addEventListener('activate',e=>{e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('osfit-shell-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]))});
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
if(req.mode==='navigate'){e.respondWith(fetch(req).then(res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(cache=>cache.put(req,c))}return res}).catch(()=>caches.match(req).then(r=>r||Response.error())));return}
e.respondWith(caches.match(req).then(c=>c||fetch(req).then(res=>{if(res.ok&&new URL(req.url).pathname.includes('/assets/')){const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy))}return res})))})
