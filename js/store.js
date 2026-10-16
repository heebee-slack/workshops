// Picks the backend: Firebase when js/config.js has keys, otherwise the in-browser demo.
import { DEMO } from './config.js';
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES } from './defaults.js';

const backend = DEMO ? await import('./store-demo.js') : await import('./store-firebase.js');
export const store = backend.default;
export const isDemo = DEMO;

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
