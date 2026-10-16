// Picks the backend (Firebase when js/config.js has keys, otherwise the in-browser demo)
// and wraps reads in a stale-while-revalidate cache so screens render instantly.
import { DEMO } from './config.js';
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES } from './defaults.js';

const backend = DEMO ? await import('./store-demo.js') : await import('./store-firebase.js');
const raw = backend.default;
export const isDemo = DEMO;

// ---------- cache ----------
// Public data is also kept in localStorage so a cold start paints immediately.
// Bookings / admin lists stay in memory only (personal data).
const LS_KEY = 'hbw-cache-v1';
const PERSIST = /^(settings|events:public|chefs|chef:|event:|posts:public:)/;
const mem = new Map();
const inflight = new Map();
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
try { for (const [k, v] of Object.entries(JSON.parse(localStorage.getItem(LS_KEY)) || {})) mem.set(k, { v, t: 0 }); } catch {}
let saveTimer;
const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries([...mem].filter(([k]) => PERSIST.test(k)).map(([k, e]) => [k, e.v])))); } catch {}
  }, 300);
};
let notifyTimer;
const notify = () => { clearTimeout(notifyTimer); notifyTimer = setTimeout(() => window.dispatchEvent(new Event('hbw-data')), 60); };

function fetchInto(key, fetcher) {
  if (inflight.has(key)) return inflight.get(key);
  const p = fetcher().then((v) => {
    const prev = mem.get(key);
    const changed = !prev || JSON.stringify(prev.v) !== JSON.stringify(v);
    mem.set(key, { v, t: Date.now() });
    if (PERSIST.test(key)) persist();
    if (prev && changed) notify();
    return v;
  }).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// Cached value now (refreshed in the background), or wait for the network on a miss.
function cached(key, fetcher, { fallback } = {}) {
  const hit = mem.get(key) || (fallback && fallback());
  if (hit) {
    if (Date.now() - hit.t > 4000) fetchInto(key, fetcher).catch(() => {});
    return Promise.resolve(clone(hit.v));
  }
  return fetchInto(key, fetcher).then(clone);
}
const findIn = (listKey, id) => { const l = mem.get(listKey); const v = l?.v?.find?.((x) => x.id === id); return v ? { v, t: 0 } : null; };

export function invalidate() {
  mem.clear();
  try { localStorage.removeItem(LS_KEY); } catch {}
}

const READS = {
  getSettings: () => cached('settings', () => raw.getSettings()),
  listEvents: ({ all = false } = {}) => cached(all ? 'events:all' : 'events:public', () => raw.listEvents({ all })),
  getEvent: (id) => cached(`event:${id}`, () => raw.getEvent(id), { fallback: () => findIn('events:public', id) || findIn('events:all', id) }),
  listChefs: () => cached('chefs', () => raw.listChefs()),
  getChef: (id) => cached(`chef:${id}`, () => raw.getChef(id), { fallback: () => findIn('chefs', id) }),
  listPosts: (chefId, { all = false } = {}) => cached(`posts:${all ? 'all' : 'public'}:${chefId}`, () => raw.listPosts(chefId, { all })),
  listBookings: (eventId) => cached(`bookings:${eventId || '*'}`, () => raw.listBookings(eventId)),
  listInvites: () => cached('invites', () => raw.listInvites()),
  listUpdates: () => cached('updates', () => raw.listUpdates()),
};

// Everything else passes through; any write clears the cache so the next read is fresh.
const PASS = new Set(['onAuth', 'isInviteLink', 'getChefIdForEmail', 'resetDemo', 'signIn', 'signOut', 'sendInvite', 'resetPassword', 'completeInvite']);
export const store = new Proxy(raw, {
  get(target, prop) {
    if (READS[prop]) return READS[prop];
    const fn = target[prop];
    if (typeof fn !== 'function' || PASS.has(prop)) return typeof fn === 'function' ? fn.bind(target) : fn;
    return async (...args) => { const r = await fn.apply(target, args); invalidate(); return r; };
  },
});

export async function getSettings() {
  const s = (await store.getSettings()) || {};
  return { ...DEFAULT_SETTINGS, ...s, templates: { ...DEFAULT_TEMPLATES, ...(s.templates || {}) } };
}

// Recount confirmed seats per batch from the bookings themselves (self-healing).
export async function syncCounts(eventId, bookings) {
  bookings = bookings || (await store.listBookings(eventId));
  const confirmed = {};
  bookings.filter((b) => b.status === 'confirmed').forEach((b) => { confirmed[b.batchId] = (confirmed[b.batchId] || 0) + 1; });
  await store.patchEvent(eventId, { confirmed });
  return confirmed;
}

// Smallest seat number not already taken in that batch.
export function nextSpot(bookings, batchId, excludeId) {
  const taken = new Set(bookings.filter((b) => b.batchId === batchId && b.status === 'confirmed' && b.id !== excludeId).map((b) => b.spot));
  let n = 1; while (taken.has(n)) n++;
  return n;
}
