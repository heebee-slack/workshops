import { MAX_UPLOAD_BYTES } from './config.js?v=20261016154407';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const uid = (n = 10) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
export const makeRef = () => 'HB-' + Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

// ---------- dates ----------
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const parseDate = (d) => { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day); };
export const fmtDate = (d) => { const x = parseDate(d); return `${DAYS[x.getDay()]} ${x.getDate()} ${MONTHS[x.getMonth()]}`; };
export const fmtDateLong = (d) => { const x = parseDate(d); return `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][x.getDay()]}, ${x.getDate()} ${MONTHS[x.getMonth()]}`; };
export const fmtTime = (t) => {
  if (!t) return '';
  let [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return m ? `${h}:${String(m).padStart(2, '0')} ${ap}` : `${h} ${ap}`;
};
export const fmtDuration = (mins) => {
  mins = Number(mins) || 0; const h = Math.floor(mins / 60), m = mins % 60;
  if (!h) return `${m} min`;
  return `${h} hr${h > 1 ? 's' : ''}${m ? ` ${m} min` : ''}`;
};
export const fmtPrice = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
export const batchStart = (b) => { const d = parseDate(b.date); const [h, m] = (b.time || '00:00').split(':').map(Number); d.setHours(h, m); return d; };
export const timeAgo = (ts) => {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`;
};
export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ---------- event helpers ----------
export const sortBatches = (batches = []) => [...batches].sort((a, b) => batchStart(a) - batchStart(b));
export const upcomingBatches = (ev) => sortBatches(ev.batches).filter((b) => batchStart(b) > new Date());
// "Coming soon" workshops are announced without open booking; they're never treated as past.
export const isSoon = (ev) => ev.bookingMode === 'soon';
export const isPast = (ev) => !isSoon(ev) && (!(ev.batches || []).length || upcomingBatches(ev).length === 0);
export const seatsLeft = (ev, b) => Math.max(0, (Number(b.seats) || 0) - ((ev.confirmed || {})[b.id] || 0));
export const batchPrice = (ev, b) => Number(b?.price) || Number(ev.price) || 0;
export const minPrice = (ev) => { const ps = (ev.batches || []).map((b) => batchPrice(ev, b)).filter(Boolean); return ps.length ? Math.min(...ps) : Number(ev.price) || 0; };
export const nextBatch = (ev) => upcomingBatches(ev)[0];
export const firstOpenBatch = (ev, after) => {
  const list = upcomingBatches(ev); const start = after ? list.findIndex((b) => b.id === after.id) + 1 : 0;
  return list.slice(start).find((b) => seatsLeft(ev, b) > 0);
};
export const totalSeatsLeft = (ev) => upcomingBatches(ev).reduce((n, b) => n + seatsLeft(ev, b), 0);
export const batchLabel = (b) => `${fmtDate(b.date)} · ${fmtTime(b.time)}`;
export const batchIndex = (ev, b) => sortBatches(ev.batches).findIndex((x) => x.id === b.id) + 1;
export const dateRange = (ev) => {
  const bs = sortBatches(ev.batches); if (!bs.length) return '';
  const a = bs[0].date, z = bs[bs.length - 1].date;
  if (a === z) return fmtDate(a);
  const A = parseDate(a), Z = parseDate(z);
  return A.getMonth() === Z.getMonth() && A.getFullYear() === Z.getFullYear() ? `${A.getDate()}–${Z.getDate()} ${MONTHS[Z.getMonth()]}` : `${A.getDate()} ${MONTHS[A.getMonth()]} – ${Z.getDate()} ${MONTHS[Z.getMonth()]}`;
};

// ---------- phone / whatsapp ----------
export const digits = (s) => String(s || '').replace(/\D/g, '');
export const normPhone = (s) => {
  let d = digits(s);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = '91' + d;
  return d;
};
export const validPhone = (s) => { const d = normPhone(s); return d.length >= 11 && d.length <= 15; };
export const prettyPhone = (s) => { const d = normPhone(s); return d.startsWith('91') && d.length === 12 ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : '+' + d; };
// api.whatsapp.com directly: the wa.me redirect mangles emoji into �.
export const waLink = (phone, text) => `https://api.whatsapp.com/send?phone=${normPhone(phone)}&text=${encodeURIComponent(text)}`;
export const validEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());
export const fillTemplate = (tpl, vars) => String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
export const siteUrl = () => location.origin + location.pathname;

// ---------- images ----------
// Downscale big phone photos so every upload lands well under the 5 MB cap.
export async function resizeImage(file, { maxDim = 2048, quality = 0.85, maxBytes = MAX_UPLOAD_BYTES } = {}) {
  if (!(file.type || 'image/').startsWith('image/')) throw new Error('Choose an image file');
  let bitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { bitmap = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That image could not be read. Try a JPG or PNG.')); i.src = URL.createObjectURL(file); }); }
  let dim = maxDim, q = quality, blob;
  for (let i = 0; i < 8; i++) {
    const scale = Math.min(1, dim / Math.max(bitmap.width, bitmap.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bitmap.width * scale); c.height = Math.round(bitmap.height * scale);
    c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
    blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
    if (blob && blob.size <= maxBytes) return blob;
    dim = Math.round(dim * 0.8); q = Math.max(0.6, q - 0.08);
  }
  if (!blob || blob.size > maxBytes) throw new Error('Image is too large even after resizing');
  return blob;
}
// A photo URL can carry a tiny blurred preview (t) and a small copy (s) after "#hbw=".
// It's a URL fragment, so browsers never send it to the server; the field stays a plain string.
export function imgMeta(u) {
  if (!u) return { src: '' };
  const i = u.indexOf('#hbw=');
  if (i < 0) return { src: u };
  try { return { src: u.slice(0, i), ...JSON.parse(decodeURIComponent(u.slice(i + 5))) }; } catch { return { src: u.slice(0, i) }; }
}
export const packImg = (src, meta) => `${src}#hbw=${encodeURIComponent(JSON.stringify(meta))}`;
export const previewOf = async (blob) => blobToDataUrl(await resizeImage(blob, { maxDim: 20, quality: 0.5 }));
// <img> that shows its blurred preview (or a warm placeholder) until the real photo has loaded.
export const photo = (url, { cls = '', alt = '', eager = false, small = false } = {}) => {
  if (!url) return '';
  const m = imgMeta(url);
  const src = (small && m.s) || m.src;
  const bg = m.t ? ` style="background-image:url('${m.t}')"` : '';
  return `<img class="ph ${cls}" src="${esc(src)}" alt="${esc(alt)}"${bg} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
};
export const preload = (url, small = false) => { if (url) { const m = imgMeta(url); new Image().src = (small && m.s) || m.src; } };
export const blobToDataUrl = (blob) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });

// ---------- UI primitives ----------
export function toast(msg, { action, onAction, bad = false, ms = 3800 } = {}) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = 'toast' + (bad ? ' bad' : '');
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="btn xs">${esc(action)}</button>` : ''}`;
  if (action) $('button', el).onclick = () => { onAction?.(); el.remove(); };
  root.appendChild(el);
  setTimeout(() => el.remove(), action ? ms * 2.5 : ms);
}

export function openSheet(html, { center = false, onClose } = {}) {
  const bd = document.createElement('div');
  bd.className = 'sheet-backdrop' + (center ? ' center' : '');
  bd.innerHTML = `<div class="sheet${center ? ' center-sheet' : ''}" role="dialog" aria-modal="true">${center ? '' : '<div class="grab"></div>'}${html}</div>`;
  document.body.appendChild(bd);
  document.body.classList.add('modal-open');
  const sheet = $('.sheet', bd);
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    sheet.classList.add('sheet-closing'); bd.style.transition = 'opacity .3s'; bd.style.opacity = '0';
    setTimeout(() => { bd.remove(); if (!$('.sheet-backdrop')) document.body.classList.remove('modal-open'); onClose?.(); }, 280);
  };
  bd.addEventListener('click', (e) => { if (e.target === bd) close(); });
  $$('[data-close]', sheet).forEach((b) => (b.onclick = close));
  const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
  return { el: sheet, close, set(html2) { sheet.innerHTML = (center ? '' : '<div class="grab"></div>') + html2; $$('[data-close]', sheet).forEach((b) => (b.onclick = close)); } };
}

export function confirmBox(title, body, { ok = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const s = openSheet(`
      <h2 style="margin:6px 0 8px;font-weight:300;font-size:1.3rem">${esc(title)}</h2>
      <p class="muted small" style="margin:0 0 20px;white-space:pre-line">${esc(body)}</p>
      <div class="row2"><button class="btn ghost" data-no>Cancel</button><button class="btn ${danger ? 'danger' : ''}" data-yes>${esc(ok)}</button></div>`,
    { center: true, onClose: () => { if (!answered) resolve(false); } });
    $('[data-no]', s.el).onclick = () => { answered = true; resolve(false); s.close(); };
    $('[data-yes]', s.el).onclick = () => { answered = true; resolve(true); s.close(); };
  });
}

export function lightbox(src, caption, placeholder) {
  const el = document.createElement('div');
  el.className = 'lightbox';
  const m = imgMeta(src), p = placeholder ? imgMeta(placeholder) : {};
  const bg = p.src || m.t ? ` style="background-image:url('${esc(p.src || m.t)}');background-size:contain;background-repeat:no-repeat;background-position:center"` : '';
  el.innerHTML = `<button class="icon-btn glass-photo close" aria-label="Close">✕</button><img src="${esc(m.src)}" alt=""${bg}><p class="cap">${esc(caption || '')}</p>`;
  el.onclick = (e) => { if (e.target === el || e.target.closest('.close')) el.remove(); };
  document.body.appendChild(el);
}

export function setFieldError(field, msg) {
  if (!field) return;
  field.classList.toggle('err', !!msg);
  const m = $('.err-msg', field); if (m) m.textContent = msg || '';
}

export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copied'); }
  catch { prompt('Copy this:', t); }
}

export async function shareLink(title, text, url) {
  if (navigator.share) { try { await navigator.share({ title, text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  copyText(url);
}

export const ICON = {
  back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  share: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6"/></svg>',
};
export const loading = () => `<div class="empty" style="padding-top:30vh"><div class="sym spin">✦</div></div>`;
