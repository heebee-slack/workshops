// Page: network first (fresh after every deploy), saved copy when offline or slow.
// Versioned app files (?v=…), Firebase SDK, fonts and photos: stored once, served from the phone.
const VERSION = 'hbw-20261016130742';
const PAGES = 'hbw-pages';
const FILES = `${VERSION}-files`;
const PHOTOS = 'hbw-photos';

const trim = async (c, max) => { const keys = await c.keys(); for (const k of keys.slice(0, Math.max(0, keys.length - max))) await c.delete(k); };

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => ![PAGES, FILES, PHOTOS].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

function cacheFirst(cacheName, req, max) {
  return caches.open(cacheName).then(async (c) => {
    const hit = await c.match(req);
    if (hit) return hit;
    const r = await fetch(req);
    if (r.ok || r.type === 'opaque') c.put(req, r.clone()).then(() => max && trim(c, max));
    return r;
  });
}

async function pageNetworkFirst(req) {
  const c = await caches.open(PAGES);
  const key = new URL(req.url); key.hash = ''; key.search = '';
  const net = fetch(key.href, { cache: 'no-cache', credentials: 'same-origin' })
    .then((r) => { if (r.ok) c.put(key.href, r.clone()); return r; });
  const timeout = new Promise((res) => setTimeout(res, 2500));
  try {
    const r = await Promise.race([net, timeout]);
    if (r) return r;
  } catch {}
  return (await c.match(key.href)) || net;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate' && url.origin === location.origin) { e.respondWith(pageNetworkFirst(req)); return; }
  if (url.hostname === 'firebasestorage.googleapis.com') { e.respondWith(cacheFirst(PHOTOS, req, 120)); return; }
  const versioned = url.origin === location.origin && url.searchParams.has('v');
  const vendor = url.hostname === 'www.gstatic.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com';
  if (versioned || vendor) e.respondWith(cacheFirst(FILES, req));
});
