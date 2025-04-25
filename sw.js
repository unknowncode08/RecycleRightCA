const CACHE_NAME='recyclerightca-v1';
const ASSETS=[
  '/',
  '/index.html',
  '/mobile/',
  '/mobile/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];
self.addEventListener('install',evt=>evt.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS))).then(()=>self.skipWaiting()));
self.addEventListener('activate',evt=>evt.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))).then(()=>self.clients.claim()));
self.addEventListener('fetch',evt=>{if(evt.request.method!=='GET')return;evt.respondWith(caches.match(evt.request).then(cached=>cached||fetch(evt.request)));});
