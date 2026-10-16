// Backends: demo (no Firebase keys) · REST for public screens (tiny, no SDK) · Firebase SDK, loaded
// only when someone signs in (admin / chef). Reads are wrapped in a stale-while-revalidate cache.
import { DEMO } from './config.js?v=20261016130232';
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES } from './defaults.js?v=20261016130232';

export const isDemo = DEMO;
const demo = DEMO ? (await import('./store-demo.js?v=20261016130232')).default : null;
const rest = DEMO ? null : (await import('./store-rest.js?v=20261016130232')).default;
let fbPromise = null;
const loadFb = () => (DEMO ? Promise.resolve(demo) : (fbPromise ||= import('./store-firebase.js?v=20261016130232').then((m) => m.default)));
let signedIn = false;
// Signed-in sessions (admin/chef) read through the SDK so drafts and private data follow their permissions.
const reader = async () => (DEMO ? demo : signedIn ? loadFb() : rest);
export const hasSession = () => { try { return Object.keys(localStorage).some((k) => k.startsWith('firebase:authUser:')); } catch { return false; } };

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
  getSettings: () => cached('settings', async () => (await reader()).getSettings()),
  listEvents: ({ all = false } = {}) => cached(all ? 'events:all' : 'events:public', async () => (all ? loadFb() : reader()).then((b) => b.listEvents({ all }))),
  getEvent: (id) => cached(`event:${id}`, async () => (await reader()).getEvent(id), { fallback: () => findIn('events:public', id) || findIn('events:all', id) }),
  listChefs: () => cached('chefs', async () => (await reader()).listChefs()),
  getChef: (id) => cached(`chef:${id}`, async () => (await reader()).getChef(id), { fallback: () => findIn('chefs', id) }),
  listPosts: (chefId, { all = false } = {}) => cached(`posts:${all ? 'all' : 'public'}:${chefId}`, async () => (all ? loadFb() : reader()).then((b) => b.listPosts(chefId, { all }))),
  listBookings: (eventId) => cached(`bookings:${eventId || '*'}`, async () => (await loadFb()).listBookings(eventId)),
  listInvites: () => cached('invites', async () => (await loadFb()).listInvites()),
  listUpdates: () => cached('updates', async () => (await loadFb()).listUpdates()),
};

const SPECIAL = {
  onAuth(cb) { loadFb().then((fb) => fb.onAuth((u) => { signedIn = !!u; cb(u); })); },
  // Firebase invite links carry mode=signIn and an oobCode; checking that needs no SDK.
  isInviteLink() { if (DEMO) return false; const p = new URLSearchParams(location.search); return p.get('mode') === 'signIn' && p.has('oobCode'); },
  resetDemo() { demo?.resetDemo(); },
  // Customers' sign-ups: lightweight requests, and they don't change anything public, so keep the cache.
  createBooking: async (b) => (signedIn || DEMO ? (await loadFb()).createBooking(b) : rest.createBooking(b)),
  createUpdate: async (u) => (signedIn || DEMO ? (await loadFb()).createUpdate(u) : rest.createUpdate(u)),
};

// Everything else needs the SDK; writes clear the cache so the next read is fresh.
const NO_INVALIDATE = new Set(['signIn', 'signOut', 'sendInvite', 'resetPassword', 'completeInvite', 'getChefIdForEmail', 'upload', 'uploadChef']);
export const store = new Proxy({}, {
  get(_, prop) {
    if (READS[prop]) return READS[prop];
    if (SPECIAL[prop]) return SPECIAL[prop];
    return async (...args) => {
      const fb = await loadFb();
      const r = await fb[prop](...args);
      if (!NO_INVALIDATE.has(prop)) invalidate();
      return r;
    };
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
