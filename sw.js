// App shell + photos served from the phone; refreshed in the background.
const VERSION = 'hbw-v3';
const SHELL = `${VERSION}-shell`;
const PHOTOS = 'hbw-photos';

const trim = async (c, max) => { const keys = await c.keys(); for (const k of keys.slice(0, Math.max(0, keys.length - max))) await c.delete(k); };

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== PHOTOS).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Uploaded photos have unique names, so a stored copy never goes stale.
  if (url.hostname === 'firebasestorage.googleapis.com') {
    e.respondWith(caches.open(PHOTOS).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') e.waitUntil(c.put(req, r.clone()).then(() => trim(c, 80)));
      return r;
    }));
    return;
  }

  // Own files, Firebase SDK and fonts: answer from cache, update it for next time.
  const shell = url.origin === location.origin || url.hostname === 'www.gstatic.com' || url.hostname.endsWith('fonts.googleapis.com') || url.hostname === 'fonts.gstatic.com';
  if (!shell) return;
  e.respondWith(caches.open(SHELL).then(async (c) => {
    const hit = await c.match(req);
    const net = fetch(req, url.origin === location.origin ? { cache: 'no-cache' } : {}).then((r) => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
    if (hit) { e.waitUntil(net); return hit; }
    return net;
  }));
});
