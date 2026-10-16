// Firebase backend: Firestore for data, Storage for photos, Auth for admin + chefs.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, sendSignInLinkToEmail,
  isSignInWithEmailLink, signInWithEmailLink, updatePassword, sendPasswordResetEmail, setPersistence, browserLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, writeBatch, increment, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage, ref as sref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { FIREBASE_CONFIG, FIRESTORE_DATABASE_ID, MAX_POSTS_PER_CHEF, ADMIN_EMAILS } from './config.js?v=20261016130635';
import { uid, makeRef, siteUrl } from './util.js?v=20261016130635';

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const fs = getFirestore(app, FIRESTORE_DATABASE_ID);
const st = getStorage(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

const toMs = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : v);
const data = (snap) => {
  const d = snap.data(); if (!d) return null;
  for (const k of ['createdAt', 'agreedAt', 'confirmedAt', 'paymentRequestedAt', 'notifiedAt', 'remindedAt', 'updatedAt', 'invitedAt']) if (d[k]) d[k] = toMs(d[k]);
  return { ...d, id: snap.id };
};
const all = async (q) => (await getDocs(q)).docs.map(data);
const friendly = (e) => {
  const map = {
    'auth/invalid-credential': 'Email or password is incorrect', 'auth/wrong-password': 'Email or password is incorrect', 'auth/user-not-found': 'No account found for that email',
    'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.', 'auth/invalid-action-code': 'This invite link has expired or was already used. Ask Heebee for a new one.',
    'auth/weak-password': 'Use at least 8 characters for your password', 'auth/invalid-email': 'That email address is not valid', 'permission-denied': 'You don\'t have permission to do that',
  };
  const err = new Error(map[e.code] || e.message || 'Something went wrong'); err.code = e.code; return err;
};
const guard = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { throw friendly(e); } };

// Admin uploads chef photos under chefs/{chefId}; chefs upload under chefmedia/{their email}
// (Storage rules can't look up a non-"(default)" Firestore database, so the path itself proves ownership).
const chefPath = (chefId, name) => {
  const email = (auth.currentUser?.email || '').toLowerCase();
  return ADMIN_EMAILS.includes(email) ? `chefs/${chefId}/${name}` : `chefmedia/${email}/${name}`;
};
const userObj = (u) => (u ? { email: (u.email || '').toLowerCase(), uid: u.uid, emailVerified: u.emailVerified } : null);

export default {
  // ---- auth ----
  onAuth(cb) { return onAuthStateChanged(auth, (u) => cb(userObj(u))); },
  signIn: guard(async (email, password) => { await signInWithEmailAndPassword(auth, email.trim(), password); }),
  signOut: guard(() => fbSignOut(auth)),
  sendInvite: guard(async (email) => {
    await sendSignInLinkToEmail(auth, email.trim().toLowerCase(), { url: siteUrl() + '?invite=1', handleCodeInApp: true });
    await updateDoc(doc(fs, 'chefInvites', email.trim().toLowerCase()), { invitedAt: serverTimestamp() }).catch(() => {});
  }),
  isInviteLink() { return isSignInWithEmailLink(auth, location.href); },
  completeInvite: guard(async (email, password) => {
    const cred = await signInWithEmailLink(auth, email.trim().toLowerCase(), location.href);
    await updatePassword(cred.user, password);
    history.replaceState(null, '', siteUrl() + '#/chef');
  }),
  resetPassword: guard((email) => sendPasswordResetEmail(auth, email.trim(), { url: siteUrl() + '#/chef' })),

  // ---- settings ----
  getSettings: guard(async () => data(await getDoc(doc(fs, 'settings', 'main')))),
  saveSettings: guard((patch) => setDoc(doc(fs, 'settings', 'main'), patch, { merge: true })),

  // ---- events ----
  listEvents: guard(({ all: everything = false } = {}) => all(everything ? collection(fs, 'events') : query(collection(fs, 'events'), where('status', '==', 'published')))),
  getEvent: guard(async (id) => { try { return data(await getDoc(doc(fs, 'events', id))); } catch (e) { if (e.code === 'permission-denied') return null; throw e; } }),
  saveEvent: guard(async (ev) => {
    const { id: existing, confirmed, ...rest } = ev;
    if (existing) { await updateDoc(doc(fs, 'events', existing), rest); return existing; }
    const id = uid();
    await setDoc(doc(fs, 'events', id), { ...rest, confirmed: {}, createdAt: Date.now() });
    return id;
  }),
  patchEvent: guard((id, patch) => updateDoc(doc(fs, 'events', id), patch)),
  deleteEvent: guard((id) => deleteDoc(doc(fs, 'events', id))),

  // ---- chefs ----
  listChefs: guard(() => all(collection(fs, 'chefs'))),
  getChef: guard(async (id) => data(await getDoc(doc(fs, 'chefs', id)))),
  saveChef: guard(async (chef) => { const id = chef.id || uid(); const { id: _, ...rest } = chef; await setDoc(doc(fs, 'chefs', id), { ...rest, updatedAt: Date.now() }, { merge: true }); return id; }),
  createChef: guard(async ({ name, title, email }) => {
    email = email.trim().toLowerCase();
    if ((await getDoc(doc(fs, 'chefInvites', email))).exists()) throw new Error('A chef with that email already exists');
    const id = uid(); const b = writeBatch(fs);
    b.set(doc(fs, 'chefs', id), { name, title: title || '', photoUrl: '', bio: '', experience: [], achievements: [], instagram: '', blocked: false, postCount: 0, createdAt: Date.now() });
    b.set(doc(fs, 'chefInvites', email), { chefId: id, createdAt: Date.now() });
    await b.commit(); return id;
  }),
  deleteChef: guard(async (id) => {
    const b = writeBatch(fs); b.delete(doc(fs, 'chefs', id));
    (await getDocs(query(collection(fs, 'chefInvites'), where('chefId', '==', id)))).forEach((s) => b.delete(s.ref));
    await b.commit();
  }),
  getChefIdForEmail: guard(async (email) => { const s = await getDoc(doc(fs, 'chefInvites', String(email).toLowerCase())); return s.exists() ? s.data().chefId : null; }),
  listInvites: guard(async () => (await getDocs(collection(fs, 'chefInvites'))).docs.map((s) => ({ email: s.id, ...s.data(), invitedAt: toMs(s.data().invitedAt) }))),

  // ---- posts (≤ 21 per chef, counter kept on the chef doc) ----
  listPosts: guard(async (chefId, { all: everything = false } = {}) => {
    const col = collection(fs, 'chefs', chefId, 'posts');
    const list = await all(everything ? col : query(col, where('hidden', '==', false)));
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }),
  addPost: guard(async (chefId, blob, caption, thumb) => {
    const chef = data(await getDoc(doc(fs, 'chefs', chefId)));
    if ((chef.postCount || 0) >= MAX_POSTS_PER_CHEF) throw new Error(`You can have up to ${MAX_POSTS_PER_CHEF} posts. Delete one to add another.`);
    const pid = uid(); const path = chefPath(chefId, `${pid}.jpg`);
    const r = sref(st, path); await uploadBytes(r, blob, { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' });
    const imageUrl = await getDownloadURL(r);
    let thumbUrl = '', thumbPath = '';
    if (thumb) { thumbPath = chefPath(chefId, `${pid}_t.jpg`); const tr = sref(st, thumbPath); await uploadBytes(tr, thumb, { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' }); thumbUrl = await getDownloadURL(tr); }
    const b = writeBatch(fs);
    b.set(doc(fs, 'chefs', chefId, 'posts', pid), { imageUrl, thumbUrl, storagePath: path, thumbPath, caption: caption || '', hidden: false, createdAt: Date.now() });
    b.update(doc(fs, 'chefs', chefId), { postCount: increment(1) });
    await b.commit();
  }),
  updatePost: guard((chefId, pid, patch) => updateDoc(doc(fs, 'chefs', chefId, 'posts', pid), patch)),
  deletePost: guard(async (chefId, post) => {
    const b = writeBatch(fs);
    b.delete(doc(fs, 'chefs', chefId, 'posts', post.id));
    b.update(doc(fs, 'chefs', chefId), { postCount: increment(-1) });
    await b.commit();
    if (post.storagePath) deleteObject(sref(st, post.storagePath)).catch(() => {});
    if (post.thumbPath) deleteObject(sref(st, post.thumbPath)).catch(() => {});
  }),

  // ---- bookings (public can only create; admin reads) ----
  createBooking: guard(async (b) => {
    const ref = makeRef();
    const d = await addDoc(collection(fs, 'bookings'), { ...b, ref, status: 'waitlist', spot: null, createdAt: Date.now() });
    return { id: d.id, ref };
  }),
  listBookings: guard((eventId) => all(eventId ? query(collection(fs, 'bookings'), where('eventId', '==', eventId)) : collection(fs, 'bookings'))),
  updateBooking: guard((id, patch) => updateDoc(doc(fs, 'bookings', id), patch)),
  deleteBooking: guard((id) => deleteDoc(doc(fs, 'bookings', id))),

  // ---- keep me updated ----
  createUpdate: guard((u) => addDoc(collection(fs, 'updates'), { ...u, createdAt: Date.now(), notifiedAt: null })),
  listUpdates: guard(() => all(collection(fs, 'updates'))),
  updateUpdate: guard((id, patch) => updateDoc(doc(fs, 'updates', id), patch)),
  deleteUpdate: guard((id) => deleteDoc(doc(fs, 'updates', id))),

  // ---- files ----
  uploadChef: guard(async (chefId, blob) => { const r = sref(st, chefPath(chefId, `profile-${uid(6)}.jpg`)); await uploadBytes(r, blob, { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' }); return getDownloadURL(r); }),
  upload: guard(async (path, blob) => { const r = sref(st, path); await uploadBytes(r, blob, { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' }); return getDownloadURL(r); }),
  removeFile: async (path) => { try { await deleteObject(sref(st, path)); } catch {} },
};
