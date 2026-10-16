// Public reads and waitlist sign-ups over Firestore's REST API: one plain HTTPS request each,
// no SDK download and no connection handshake. Same security rules apply.
import { FIREBASE_CONFIG, FIRESTORE_DATABASE_ID } from './config.js?v=20261016131307';
import { makeRef } from './util.js?v=20261016131307';

const BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/${FIRESTORE_DATABASE_ID}/documents`;
const KEY = `key=${FIREBASE_CONFIG.apiKey}`;

const decode = (v) => {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('mapValue' in v) return fields(v.mapValue.fields);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  return null;
};
const fields = (f = {}) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, decode(v)]));
const toDoc = (d) => ({ ...fields(d.fields), id: d.name.split('/').pop() });

const encode = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)])) } };
  return { stringValue: String(v) };
};

async function req(path, opts = {}) {
  const r = await fetch(`${BASE}${path}${path.includes('?') ? '&' : '?'}${KEY}`, {
    ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (r.status === 404 || r.status === 403) return { missing: true, status: r.status };
  if (!r.ok) throw new Error(r.status === 429 ? 'Too many requests. Try again in a moment.' : 'Could not reach Heebee. Check your connection and try again.');
  return r.json();
}

const query = async (parent, collectionId, where) => {
  const body = { structuredQuery: { from: [{ collectionId }], ...(where ? { where: { fieldFilter: { field: { fieldPath: where[0] }, op: 'EQUAL', value: encode(where[1]) } } } : {}) } };
  const res = await req(`${parent}:runQuery`, { method: 'POST', body: JSON.stringify(body) });
  if (res.missing) throw Object.assign(new Error('permission-denied'), { code: 'permission-denied' });
  return res.filter((x) => x.document).map((x) => toDoc(x.document));
};
const getOne = async (path) => { const d = await req(path); return d.missing ? null : toDoc(d); };
const create = async (collection, data) => {
  const d = await req(`/${collection}`, { method: 'POST', body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encode(v)])) }) });
  if (d.missing) throw Object.assign(new Error('Could not save. Please check your details and try again.'), { code: 'permission-denied' });
  return d.name.split('/').pop();
};

export default {
  getSettings: () => getOne('/settings/main'),
  listEvents: () => query('', 'events', ['status', 'published']),
  getEvent: (id) => getOne(`/events/${encodeURIComponent(id)}`),
  listChefs: async () => { const d = await req('/chefs?pageSize=300'); return (d.documents || []).map(toDoc); },
  getChef: (id) => getOne(`/chefs/${encodeURIComponent(id)}`),
  listPosts: async (chefId) => (await query(`/chefs/${encodeURIComponent(chefId)}`, 'posts', ['hidden', false])).sort((a, b) => b.createdAt - a.createdAt),
  createBooking: async (b) => {
    const ref = makeRef();
    const id = await create('bookings', { ...b, ref, status: 'waitlist', spot: null, createdAt: Date.now() });
    return { id, ref };
  },
  createUpdate: (u) => create('updates', { ...u, createdAt: Date.now(), notifiedAt: null }),
};
