// Demo backend: everything lives in this browser's localStorage. Used until Firebase keys are added.
import { ADMIN_EMAILS, MAX_POSTS_PER_CHEF } from './config.js?v=20261016130232';
import { uid, makeRef, blobToDataUrl } from './util.js?v=20261016130232';

const KEY = 'hbw-demo-v1';
const USER_KEY = 'hbw-demo-user';

const art = (a, b, c, motif = '') => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="g" cx="35%" cy="30%" r="90%"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>
  <filter id="b"><feGaussianBlur stdDeviation="30"/></filter></defs>
  <rect width="800" height="1000" fill="url(#g)"/>
  <g filter="url(#b)" opacity=".55"><circle cx="600" cy="260" r="160" fill="${a}"/><circle cx="200" cy="760" r="210" fill="${c}"/></g>
  ${motif}</svg>`);
const pasta = '<g fill="none" stroke="#fff3dc" stroke-opacity=".55" stroke-width="10" stroke-linecap="round"><path d="M180 520c80-60 160 60 240 0s160 60 240 0"/><path d="M180 580c80-60 160 60 240 0s160 60 240 0"/><path d="M180 640c80-60 160 60 240 0s160 60 240 0"/><path d="M180 700c80-60 160 60 240 0s160 60 240 0"/></g>';
const latte = '<g fill="none" stroke="#fff3dc" stroke-opacity=".6" stroke-width="12"><circle cx="400" cy="560" r="190"/><path d="M400 420c-70 60-70 140 0 220 70-80 70-160 0-220z"/></g>';
const bread = '<g fill="none" stroke="#fff3dc" stroke-opacity=".55" stroke-width="12" stroke-linecap="round"><ellipse cx="400" cy="580" rx="230" ry="150"/><path d="M290 530l60 60M370 510l60 60M450 510l60 60"/></g>';
const person = (bg1, bg2, skin) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>
  <rect width="800" height="1000" fill="url(#g)"/><circle cx="400" cy="400" r="130" fill="${skin}"/><path d="M160 1000c0-200 110-330 240-330s240 130 240 330z" fill="#f4efe6"/><path d="M290 300c0-90 220-90 220 0v-40c0-70-220-70-220 0z" fill="#fff"/><rect x="275" y="230" width="250" height="80" rx="40" fill="#fff"/></svg>`);
const dish = (a, b) => art(a, b, '#3a2414', '<circle cx="400" cy="520" r="210" fill="#fff8ee" fill-opacity=".85"/><circle cx="400" cy="520" r="150" fill="' + b + '" fill-opacity=".7"/>');

const plus = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function seed() {
  const now = Date.now();
  const chefs = {
    aarav: {
      id: 'aarav', name: 'Chef Aarav Mehta', title: 'Italian cuisine · Fresh pasta', photoUrl: person('#c98a50', '#5c2f16', '#c68a62'),
      bio: 'Aarav trained in Bologna and spent eight years rolling sfoglia by hand in trattorias across Emilia-Romagna. Back home, he teaches the craft the way his nonna-mentor taught him: flour, eggs, patience, and a lot of laughter.',
      experience: [{ role: 'Head Chef', place: 'Trattoria Da Nello, Bologna', years: '2016 – 2021' }, { role: 'Pasta Lead', place: 'Olive Bar & Kitchen, Delhi', years: '2021 – 2024' }, { role: 'Workshop host', place: 'Heebee', years: '2025 – now' }],
      achievements: ['Alma School of Italian Cuisine', '500+ students taught', 'Featured in Condé Nast Traveller'],
      instagram: 'https://instagram.com/', blocked: false, postCount: 4, createdAt: now - 9e8,
    },
    meera: {
      id: 'meera', name: 'Meera Kapoor', title: 'Head barista · Latte art', photoUrl: person('#8a6a4a', '#2c1f15', '#b07a56'),
      bio: 'Meera has represented Punjab at the India Latte Art Championship twice. She runs Heebee\'s barista academy and believes anyone can pour a tulip by the end of one afternoon.',
      experience: [{ role: 'Head barista', place: 'Heebee Coffee', years: '2019 – now' }],
      achievements: ['India Latte Art Championship finalist', 'SCA Barista Skills certified'],
      instagram: '', blocked: false, postCount: 1, createdAt: now - 8e8,
    },
  };
  const posts = {
    aarav: [
      { id: 'p1', imageUrl: dish('#f2c27a', '#d2763a'), caption: 'Tagliatelle al ragù, the Sunday way.', hidden: false, createdAt: now - 4e8 },
      { id: 'p2', imageUrl: art('#f4dca8', '#c9884a', '#5c2f16', pasta), caption: 'Hand-rolled sfoglia, 0.8mm thin.', hidden: false, createdAt: now - 3e8 },
      { id: 'p3', imageUrl: dish('#e9d6a4', '#7da35a'), caption: 'Pesto genovese with basil from our garden.', hidden: false, createdAt: now - 2e8 },
      { id: 'p4', imageUrl: person('#d8a066', '#6b3a1c', '#c68a62'), caption: 'Ready for Saturday!', hidden: false, createdAt: now - 1e8 },
    ],
    meera: [{ id: 'p5', imageUrl: art('#f3dfc1', '#a0703f', '#3b2414', latte), caption: 'Rosetta practice before opening.', hidden: false, createdAt: now - 2e8 }],
  };
  const events = {
    pasta: {
      id: 'pasta', status: 'published', featured: true, title: 'Fresh Pasta Making', tagline: 'Roll, cut and cook three classic shapes by hand',
      description: 'Spend an afternoon in the Heebee kitchen learning to make fresh egg pasta from scratch.\n\nYou\'ll mix and knead the dough, roll it by hand, and cut tagliatelle, farfalle and ravioli. Then cook it with two sauces and sit down to eat what you made, with a drink on us.\n\nNo experience needed. Aprons, ingredients and equipment are all provided.',
      includes: ['All ingredients and equipment', 'Apron to keep', 'Recipe card', 'Your pasta for lunch + one beverage', 'Certificate of participation'],
      imageUrl: art('#f6d79a', '#d0813f', '#4a2410', pasta), chefId: 'aarav', durationMins: 180, price: 2499,
      venue: { name: 'Heebee, Sector 9', address: 'SCO 12, Sector 9, Chandigarh', mapsUrl: 'https://maps.google.com/?q=Heebee+Coffee+Chandigarh' },
      batches: [
        { id: 'b1', date: plus(9), time: '11:00', seats: 8, price: 2499, chefId: 'aarav' },
        { id: 'b2', date: plus(9), time: '16:00', seats: 8, price: 2499, chefId: 'aarav' },
        { id: 'b3', date: plus(10), time: '11:00', seats: 8, price: 2499, chefId: 'aarav' },
        { id: 'b4', date: plus(10), time: '16:00', seats: 8, price: 2799, chefId: 'aarav' },
        { id: 'b5', date: plus(11), time: '12:00', seats: 8, price: 2499, chefId: 'aarav' },
      ],
      confirmed: { b1: 8, b2: 5, b3: 1 }, createdAt: now - 5e8,
    },
    latte: {
      id: 'latte', status: 'published', featured: false, title: 'Latte Art Basics', tagline: 'Hearts, tulips and rosettas in one afternoon',
      description: 'Learn milk texturing and pouring technique on our La Marzocco machines. Every participant gets their own station.',
      includes: ['Unlimited milk and espresso', 'Take-home milk jug', 'Barista certificate'],
      imageUrl: art('#f3dfc1', '#a0703f', '#2b1a0e', latte), chefId: 'meera', durationMins: 120, price: 1499,
      venue: { name: 'Heebee, Elante', address: 'Elante Mall, Chandigarh', mapsUrl: '' },
      batches: [{ id: 'l1', date: plus(17), time: '15:00', seats: 6, price: 1499, chefId: 'meera' }, { id: 'l2', date: plus(18), time: '15:00', seats: 6, price: 1499, chefId: 'meera' }],
      confirmed: {}, createdAt: now - 4e8,
    },
    bread: {
      id: 'bread', status: 'published', featured: false, title: 'Sourdough 101', tagline: 'Starter, shaping and scoring',
      description: 'A hands-on introduction to naturally leavened bread.', includes: ['Starter to take home', 'One loaf baked in class'],
      imageUrl: art('#efd2a2', '#b07a44', '#3a2412', bread), chefId: 'aarav', durationMins: 240, price: 2999,
      venue: { name: 'Heebee, Sector 9', address: 'SCO 12, Sector 9, Chandigarh', mapsUrl: '' },
      batches: [{ id: 's1', date: plus(-20), time: '10:00', seats: 8, price: 2999, chefId: 'aarav' }],
      confirmed: { s1: 8 }, createdAt: now - 9e8,
    },
  };
  const bookings = {};
  const add = (eventId, batchId, name, phone, status, spot, ago) => {
    const id = uid(); bookings[id] = { id, ref: makeRef(), eventId, batchId, name, phone, whatsapp: phone, email: name.split(' ')[0].toLowerCase() + '@example.com', status, spot: spot || null, createdAt: now - ago, agreedAt: now - ago };
  };
  ['Riya Sharma', 'Kabir Singh', 'Ananya Gupta', 'Dev Malhotra', 'Isha Bedi', 'Arjun Nair', 'Sana Khan', 'Rohan Das'].forEach((n, i) => add('pasta', 'b1', n, '98140' + String(10000 + i), 'confirmed', i + 1, 6e8 - i * 1e7));
  ['Nikita Jain', 'Varun Arora', 'Pooja Sethi', 'Aman Gill', 'Tara Bhatia'].forEach((n, i) => add('pasta', 'b2', n, '98760' + String(20000 + i), 'confirmed', i + 1, 4e8 - i * 1e7));
  add('pasta', 'b3', 'Meher Sandhu', '9988012345', 'confirmed', 1, 2e8);
  add('pasta', 'b2', 'Kunal Verma', '9915098765', 'waitlist', null, 7e6);
  add('pasta', 'b3', 'Simran Kaur', '9876501234', 'waitlist', null, 3e6);
  add('pasta', 'b3', 'Aditya Rao', '9814712345', 'waitlist', null, 9e5);
  const updates = { u1: { id: 'u1', eventId: 'bread', name: 'Harleen Kaur', whatsapp: '9815012345', createdAt: now - 5e7, notifiedAt: null } };
  return { settings: { whatsapp: '919876543210', upiId: 'heebee@okhdfcbank', payeeName: 'Heebee Coffee', qrUrl: '' }, chefs, posts, events, bookings, updates, invites: { 'aarav@example.com': 'aarav', 'meera@example.com': 'meera' } };
}

let db;
function load() {
  if (db) return db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
  if (!db) { db = seed(); save(); }
  return db;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch { throw new Error('Demo storage is full. Clear demo data from Admin → Settings.'); }
}
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const wait = (v) => new Promise((r) => setTimeout(() => r(clone(v)), 60));

const listeners = new Set();
const currentUser = () => { try { return JSON.parse(sessionStorage.getItem(USER_KEY)); } catch { return null; } };
const emit = () => listeners.forEach((cb) => cb(currentUser()));

export default {
  // ---- auth ----
  onAuth(cb) { listeners.add(cb); setTimeout(() => cb(currentUser()), 0); return () => listeners.delete(cb); },
  async signIn(email) {
    email = email.trim().toLowerCase(); load();
    if (!ADMIN_EMAILS.includes(email) && !db.invites[email]) throw new Error('No account found for that email');
    sessionStorage.setItem(USER_KEY, JSON.stringify({ email, uid: email, emailVerified: true })); emit();
  },
  async signOut() { sessionStorage.removeItem(USER_KEY); emit(); },
  async sendInvite() { return { demo: true }; },
  isInviteLink() { return false; },
  async completeInvite() { throw new Error('Invites need Firebase'); },
  async resetPassword() { return { demo: true }; },

  // ---- settings ----
  async getSettings() { return wait(load().settings); },
  async saveSettings(patch) { load(); db.settings = { ...db.settings, ...clone(patch) }; save(); },

  // ---- events ----
  async listEvents({ all = false } = {}) { return wait(Object.values(load().events).filter((e) => all || e.status === 'published')); },
  async getEvent(id) { return wait(load().events[id] || null); },
  async saveEvent(ev) { load(); const id = ev.id || uid(); db.events[id] = { confirmed: {}, createdAt: Date.now(), ...db.events[id], ...clone(ev), id }; save(); return id; },
  async patchEvent(id, patch) { load(); if (db.events[id]) { Object.assign(db.events[id], clone(patch)); save(); } },
  async deleteEvent(id) { load(); delete db.events[id]; save(); },

  // ---- chefs ----
  async listChefs() { return wait(Object.values(load().chefs)); },
  async getChef(id) { return wait(load().chefs[id] || null); },
  async saveChef(chef) { load(); const id = chef.id || uid(); db.chefs[id] = { postCount: 0, blocked: false, createdAt: Date.now(), ...db.chefs[id], ...clone(chef), id }; save(); return id; },
  async createChef({ name, title, email }) {
    load(); email = email.trim().toLowerCase();
    if (db.invites[email]) throw new Error('A chef with that email already exists');
    const id = uid(); db.chefs[id] = { id, name, title: title || '', photoUrl: '', bio: '', experience: [], achievements: [], instagram: '', blocked: false, postCount: 0, createdAt: Date.now() };
    db.invites[email] = id; db.posts[id] = []; save(); return id;
  },
  async deleteChef(id) { load(); delete db.chefs[id]; delete db.posts[id]; for (const [e, c] of Object.entries(db.invites)) if (c === id) delete db.invites[e]; save(); },
  async getChefIdForEmail(email) { return load().invites[String(email).toLowerCase()] || null; },
  async listInvites() { return wait(Object.entries(load().invites).map(([email, chefId]) => ({ email, chefId }))); },

  // ---- posts ----
  async listPosts(chefId, { all = false } = {}) {
    return wait((load().posts[chefId] || []).filter((p) => all || !p.hidden).sort((a, b) => b.createdAt - a.createdAt));
  },
  async addPost(chefId, blob, caption, thumb) {
    load(); const list = db.posts[chefId] || (db.posts[chefId] = []);
    if (list.length >= MAX_POSTS_PER_CHEF) throw new Error(`You can have up to ${MAX_POSTS_PER_CHEF} posts. Delete one to add another.`);
    const imageUrl = await blobToDataUrl(blob);
    const thumbUrl = thumb ? await blobToDataUrl(thumb) : '';
    list.push({ id: uid(), imageUrl, thumbUrl, caption, hidden: false, createdAt: Date.now() });
    db.chefs[chefId].postCount = list.length; save();
  },
  async updatePost(chefId, pid, patch) { load(); const p = (db.posts[chefId] || []).find((x) => x.id === pid); if (p) { Object.assign(p, patch); save(); } },
  async deletePost(chefId, post) { load(); db.posts[chefId] = (db.posts[chefId] || []).filter((p) => p.id !== post.id); db.chefs[chefId].postCount = db.posts[chefId].length; save(); },

  // ---- bookings ----
  async createBooking(b) { load(); const id = uid(); const ref = makeRef(); db.bookings[id] = { ...clone(b), id, ref, status: 'waitlist', spot: null, createdAt: Date.now() }; save(); return { id, ref }; },
  async listBookings(eventId) { return wait(Object.values(load().bookings).filter((b) => !eventId || b.eventId === eventId)); },
  async updateBooking(id, patch) { load(); Object.assign(db.bookings[id], clone(patch)); save(); },
  async deleteBooking(id) { load(); delete db.bookings[id]; save(); },

  // ---- keep me updated ----
  async createUpdate(u) { load(); const id = uid(); db.updates[id] = { ...clone(u), id, createdAt: Date.now(), notifiedAt: null }; save(); },
  async listUpdates() { return wait(Object.values(load().updates)); },
  async updateUpdate(id, patch) { load(); Object.assign(db.updates[id], patch); save(); },
  async deleteUpdate(id) { load(); delete db.updates[id]; save(); },

  // ---- files ----
  async upload(_path, blob) { return blobToDataUrl(blob); },
  async uploadChef(_chefId, blob) { return blobToDataUrl(blob); },
  async removeFile() {},

  resetDemo() { localStorage.removeItem(KEY); db = null; },
};
