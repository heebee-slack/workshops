import { store, isDemo, getSettings, syncCounts, nextSpot } from './store.js?v=20261016123504';
import { state, render, toggleTheme, showLoading } from './app.js?v=20261016123504';

let adminNav = -1;
import { profileForm } from './chef.js?v=20261016123504';
import { TEMPLATE_VARS } from './defaults.js?v=20261016123504';
import { MAX_POSTS_PER_CHEF } from './config.js?v=20261016123504';
import {
  esc, $, $$, uid, fmtDate, fmtDateLong, fmtTime, fmtDuration, fmtPrice, sortBatches, upcomingBatches, isPast, seatsLeft, batchPrice,
  batchLabel, batchIndex, dateRange, prettyPhone, waLink, fillTemplate, siteUrl, timeAgo, resizeImage, toast, openSheet, confirmBox,
  setFieldError, loading, validEmail, todayStr, lightbox, copyText,
} from './util.js?v=20261016123504';

const TABS = [['events', 'Workshops'], ['bookings', 'Bookings'], ['chefs', 'Chefs'], ['updates', 'Stay updated'], ['settings', 'Settings']];

function shell(tab, body, { wide = true } = {}) {
  if (adminNav !== state.navId) throw Object.assign(new Error('stale view'), { stale: true });
  render(`<div class="wrap ${wide ? 'wide' : ''}">
    <div class="topbar"><a class="brand" href="#/" style="text-decoration:none">Heebee</a>
      <div class="flex"><span class="tiny muted">${esc(state.user?.email || '')}</span><button class="icon-btn glass" data-theme-toggle aria-label="Theme">◐</button><button class="btn xs ghost" data-signout>Sign out</button></div></div>
    <nav class="tabs glass">${TABS.map(([k, l]) => `<a href="#/admin/${k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</nav>
    ${body}</div>`);
  $('[data-signout]').onclick = async () => { await store.signOut(); location.hash = '#/admin'; };
}

// Re-render the current admin route after sign-in/sign-out.
let authHooked = false;
export async function routeAdmin(parts, params) {
  if (!authHooked) { authHooked = true; window.addEventListener('hbw-auth', () => { if (location.hash.startsWith('#/admin')) routeAdmin(location.hash.slice(2).split('?')[0].split('/').slice(1), new URLSearchParams(location.hash.split('?')[1] || '')); }); }
  adminNav = state.navId;
  if (!state.authReady) return showLoading();
  if (!state.user) return viewLogin();
  if (!state.isAdmin) return viewNotAdmin();
  state.settings = await getSettings();
  const [tab = 'events', id] = parts;
  if (tab === 'events') return viewEvents();
  if (tab === 'event') return viewEventEditor(id === 'new' ? null : id);
  if (tab === 'bookings') return viewBookings(id, params);
  if (tab === 'chefs') return id ? viewChefAdmin(id) : viewChefs();
  if (tab === 'updates') return viewUpdates();
  if (tab === 'settings') return viewSettings();
  viewEvents();
}

// ---------- auth ----------
function viewLogin() {
  render(`<div class="wrap" style="max-width:420px">
    <div class="topbar"><a class="brand" href="#/" style="text-decoration:none">Heebee</a><button class="icon-btn glass" data-theme-toggle aria-label="Theme">◐</button></div>
    <section class="glass card" style="margin-top:40px;padding:26px 22px">
      <div class="eyebrow">Team</div><h1 class="h-title" style="margin:6px 0 20px">Sign in</h1>
      <form id="login" novalidate>
        <div class="field"><label>Email</label><input type="email" name="email" autocomplete="username" placeholder="you@heebeecoffee.com"><div class="err-msg"></div></div>
        <div class="field"><label>Password</label><input type="password" name="password" autocomplete="current-password"><div class="err-msg"></div>
        ${isDemo ? '<div class="hint">Demo mode: the password is not checked. Use the admin email from js/config.js?v=20261016123504.</div>' : ''}</div>
        <button class="btn block" type="submit">Sign in</button>
      </form>
    </section></div>`);
  const f = $('#login');
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (!validEmail(f.email.value)) return setFieldError(f.email.closest('.field'), 'Enter your email');
    if (!isDemo && !f.password.value) return setFieldError(f.password.closest('.field'), 'Enter your password');
    const b = $('button[type=submit]', f); b.disabled = true; b.textContent = 'Signing in…';
    try { await store.signIn(f.email.value, f.password.value); }
    catch (err) { b.disabled = false; b.textContent = 'Sign in'; setFieldError(f.password.closest('.field'), err.message); }
  };
}
function viewNotAdmin() {
  render(`<div class="wrap" style="max-width:420px"><section class="glass card empty" style="margin-top:60px"><div class="sym">◇</div>
    <p>${esc(state.user.email)} isn't a team account.</p><button class="btn sm" data-out>Sign out</button></section></div>`);
  $('[data-out]').onclick = () => store.signOut();
}

// ---------- shared ----------
const chefMap = async () => Object.fromEntries((await store.listChefs()).map((c) => [c.id, c]));
const statusBadge = (ev) => ev.status !== 'published' ? '<span class="badge neutral">Draft</span>' : isPast(ev) ? '<span class="badge neutral">Past</span>' : '<span class="badge ok">Live</span>';

export function messageVars(bk, ev, extra = {}) {
  const s = state.settings;
  const b = (ev.batches || []).find((x) => x.id === bk.batchId) || {};
  const v = ev.venue || {};
  const price = batchPrice(ev, b);
  return {
    name: (bk.name || '').split(' ')[0], event: ev.title, date: b.date ? fmtDateLong(b.date) : '', time: fmtTime(b.time), duration: fmtDuration(ev.durationMins),
    venue: [v.name, v.address].filter(Boolean).join(', '), maps: v.mapsUrl ? `*Map:* ${v.mapsUrl}` : '', price: fmtPrice(price), upi: s.upiId || '(UPI ID)', payee: s.payeeName || 'Heebee',
    payLink: `${siteUrl()}#/pay?ref=${bk.ref}&am=${price}`, ref: bk.ref, spot: bk.spot ?? '', link: `${siteUrl()}#/e/${ev.id}`, ...extra,
  };
}
const msg = (key, bk, ev) => fillTemplate(state.settings.templates[key], messageVars(bk, ev)).replace(/\n{3,}/g, '\n\n');

async function uploadImage(file, folder, maxDim = 2400) {
  const blob = await resizeImage(file, { maxDim: isDemo ? 1200 : maxDim, quality: isDemo ? 0.75 : 0.85 });
  return store.upload(`${folder}/${uid()}.jpg`, blob);
}
function wireUpload(el, folder, onUrl, maxDim) {
  const input = $('input[type=file]', el);
  input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    const over = $('.over', el); const prev = over.textContent; over.textContent = 'Uploading…';
    try {
      const url = await uploadImage(file, folder, maxDim);
      el.classList.add('has'); let im = $('img', el);
      if (!im) { im = document.createElement('img'); el.prepend(im); }
      im.src = url; over.textContent = 'Change photo'; onUrl(url);
    } catch (e) { over.textContent = prev; toast(e.message, { bad: true }); }
    input.value = '';
  };
}
export const uploadBox = (url, label = 'Upload photo', h = 180) => `<div class="upload-drop ${url ? 'has' : ''}" style="min-height:${h}px">${url ? `<img src="${esc(url)}" alt="">` : ''}<span class="over">${url ? 'Change photo' : '＋ ' + label}</span><input type="file" accept="image/*"></div>`;

// ---------- events list ----------
async function viewEvents() {
  showLoading();
  const [events, bookings] = await Promise.all([store.listEvents({ all: true }), store.listBookings()]);
  const sorted = events.sort((a, b) => (isPast(a) - isPast(b)) || (sortBatches(a.batches)[0]?.date || '').localeCompare(sortBatches(b.batches)[0]?.date || ''));
  const row = (ev) => {
    const bk = bookings.filter((b) => b.eventId === ev.id);
    const seats = (ev.batches || []).reduce((n, b) => n + Number(b.seats || 0), 0);
    const conf = bk.filter((b) => b.status === 'confirmed').length, wait = bk.filter((b) => b.status === 'waitlist').length;
    return `<div class="list-row">
      ${ev.imageUrl ? `<img class="thumb" src="${esc(ev.imageUrl)}" alt="">` : '<div class="thumb"></div>'}
      <div class="grow"><div class="title">${esc(ev.title || 'Untitled')}</div>
        <div class="small muted">${esc(dateRange(ev) || 'No batches yet')} · ${(ev.batches || []).length} batch${(ev.batches || []).length === 1 ? '' : 'es'}</div>
        <div class="flex wrap-gap" style="gap:6px;margin-top:4px">${statusBadge(ev)}${ev.featured ? '<span class="badge gold">Featured</span>' : ''}<span class="badge ok">${conf}/${seats} confirmed</span>${wait ? `<span class="badge wait">${wait} waitlist</span>` : ''}</div></div>
      <div class="flex wrap-gap" style="justify-content:flex-end;gap:6px"><a class="btn xs" href="#/admin/bookings/${esc(ev.id)}">Bookings</a><a class="btn xs ghost" href="#/admin/event/${esc(ev.id)}">Edit</a></div>
    </div>`;
  };
  shell('events', `
    <div class="adm-head"><h1 class="h-title">Workshops</h1><a class="btn gold sm" href="#/admin/event/new">＋ New workshop</a></div>
    ${sorted.length ? `<section class="glass" style="padding:4px 0">${sorted.map(row).join('')}</section>` : '<section class="glass card empty"><div class="sym">✦</div><p>Create your first workshop.</p></section>'}`);
}

// ---------- event editor ----------
async function viewEventEditor(id) {
  showLoading();
  const chefs = await store.listChefs();
  const ev = id ? await store.getEvent(id) : {
    title: '', tagline: '', description: '', includes: [], imageUrl: '', chefId: chefs[0]?.id || '', durationMins: 180, price: 0,
    venue: { name: '', address: '', mapsUrl: '' }, batches: [], status: 'draft', featured: false,
  };
  if (!ev) return shell('events', '<section class="glass card empty"><p>Workshop not found.</p></section>');
  ev.venue ||= {}; ev.batches = sortBatches(ev.batches || []);
  const chefOpts = (sel) => chefs.map((c) => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}${c.blocked ? ' (blocked)' : ''}</option>`).join('');
  const hours = Math.floor((ev.durationMins || 0) / 60), mins = (ev.durationMins || 0) % 60;

  shell('events', `
    <div class="adm-head"><div><a class="tiny muted" href="#/admin/events">‹ Workshops</a><h1 class="h-title">${id ? 'Edit workshop' : 'New workshop'}</h1></div>
      ${id ? `<a class="btn xs ghost" href="#/e/${esc(id)}" target="_blank">View page ↗</a>` : ''}</div>
    <form id="evf" novalidate>
    <section class="glass card">
      <div class="label">Basics</div>
      <div class="field"><label>Background image</label><div id="ev-img">${uploadBox(ev.imageUrl, 'Upload event photo', 200)}</div><div class="hint">Shown full-bleed on the feed card and event page. Large photos are resized automatically.</div></div>
      <div class="field"><label>Title <span class="req">*</span></label><input type="text" name="title" value="${esc(ev.title)}" placeholder="Fresh Pasta Making"><div class="err-msg"></div></div>
      <div class="field"><label>Tagline</label><input type="text" name="tagline" value="${esc(ev.tagline)}" placeholder="Roll, cut and cook three classic shapes by hand"></div>
      <div class="field"><label>Description</label><textarea name="description" rows="6" placeholder="What will people do and learn?">${esc(ev.description)}</textarea></div>
      <div class="field"><label>What's included (one per line)</label><textarea name="includes" rows="4" placeholder="All ingredients and equipment&#10;Apron to keep">${esc((ev.includes || []).join('\n'))}</textarea></div>
      <div class="row2">
        <div class="field"><label>Lead chef <span class="req">*</span></label><select name="chefId">${chefs.length ? chefOpts(ev.chefId) : '<option value="">Add a chef first</option>'}</select><div class="err-msg"></div></div>
        <div class="field"><label>Default price (₹)</label><input type="number" name="price" min="0" step="1" value="${esc(ev.price || '')}" placeholder="2499"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Duration · hours</label><select name="dh">${Array.from({ length: 13 }, (_, i) => `<option ${i === hours ? 'selected' : ''}>${i}</option>`).join('')}</select></div>
        <div class="field"><label>Duration · minutes</label><select name="dm">${[0, 15, 30, 45].map((m) => `<option ${m === mins ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      </div>
    </section>

    <section class="glass card">
      <div class="label">Venue</div>
      <div class="row2">
        <div class="field"><label>Outlet / venue name</label><input type="text" name="vname" value="${esc(ev.venue.name || '')}" placeholder="Heebee, Sector 9"></div>
        <div class="field"><label>Google Maps link</label><input type="url" name="vmaps" value="${esc(ev.venue.mapsUrl || '')}" placeholder="https://maps.app.goo.gl/…"></div>
      </div>
      <div class="field"><label>Address</label><input type="text" name="vaddr" value="${esc(ev.venue.address || '')}" placeholder="SCO 12, Sector 9, Chandigarh"></div>
    </section>

    <section class="glass card">
      <div class="flex between"><div class="label" style="margin:0">Batches</div><span class="tiny muted" id="batch-count"></span></div>
      <div class="spacer"></div>
      <details class="glass" style="padding:14px 16px;border-radius:16px;margin-bottom:14px" ${ev.batches.length ? '' : 'open'}>
        <summary style="cursor:pointer;font-weight:700;font-size:.9rem">Quick add: days × start times</summary>
        <div class="spacer"></div>
        <div class="field"><label>Days</label><div class="flex"><input class="input" type="date" id="g-date" min="${todayStr()}" style="flex:1"><button type="button" class="btn sm ghost" id="g-add-day">Add day</button></div><div class="ach" id="g-days" style="margin-top:8px"></div></div>
        <div class="field"><label>Start times for each day</label><input type="text" id="g-times" placeholder="11:00, 16:00" value="11:00, 16:00"><div class="hint">24-hour format, separated by commas. 2 times × 3 days = 6 batches.</div></div>
        <div class="row3">
          <div class="field"><label>Spots per batch</label><input type="number" id="g-seats" min="1" value="8"></div>
          <div class="field"><label>Price (₹)</label><input type="number" id="g-price" min="0" placeholder="Default"></div>
          <div class="field"><label>Chef</label><select id="g-chef"><option value="">Lead chef</option>${chefOpts('')}</select></div>
        </div>
        <button type="button" class="btn sm" id="g-go">Add these batches</button>
      </details>
      <div id="batch-rows"></div>
      <div class="spacer"></div><button type="button" class="btn xs ghost" id="add-batch">＋ Add one batch</button>
      <div class="field err" id="batch-err" style="margin:10px 0 0"><div class="err-msg"></div></div>
    </section>

    <section class="glass card">
      <div class="label">Publishing</div>
      <label class="flex between" style="padding:6px 0"><span><b>Published</b><br><span class="small muted">Visible on the public feed</span></span><span class="switch"><input type="checkbox" name="published" ${ev.status === 'published' ? 'checked' : ''}><span></span></span></label>
      <label class="flex between" style="padding:6px 0"><span><b>Featured</b><br><span class="small muted">Shown as the big card at the top of the feed</span></span><span class="switch"><input type="checkbox" name="featured" ${ev.featured ? 'checked' : ''}><span></span></span></label>
    </section>

    <div class="flex between wrap-gap">
      ${id ? '<button type="button" class="btn sm danger" id="del-ev">Delete workshop</button>' : '<span></span>'}
      <button type="submit" class="btn gold">${id ? 'Save changes' : 'Create workshop'}</button>
    </div>
    </form>`);

  const f = $('#evf');
  let imageUrl = ev.imageUrl;
  wireUpload($('#ev-img .upload-drop'), 'events', (u) => (imageUrl = u));
  let batches = ev.batches.map((b) => ({ ...b, chefId: b.chefId === ev.chefId ? '' : b.chefId }));
  const confirmed = ev.confirmed || {};

  const paintBatches = () => {
    batches = sortBatches(batches.filter((b) => b.date));
    $('#batch-rows').innerHTML = batches.map((b, i) => `<div class="brow" data-i="${i}">
      <span class="bn">${i + 1}</span>
      <label class="bd"><span>Date</span><input type="date" data-k="date" value="${esc(b.date)}"></label>
      <label class="bt"><span>Start</span><input type="time" data-k="time" value="${esc(b.time)}"></label>
      <label class="bs"><span>Spots</span><input type="number" data-k="seats" min="1" value="${esc(b.seats)}"></label>
      <label class="bp"><span>Price ₹</span><input type="number" data-k="price" min="0" value="${esc(b.price ?? '')}" placeholder="${esc(f.price.value || 'Default')}"></label>
      <label class="bc"><span>Chef</span><select data-k="chefId"><option value="">Lead chef</option>${chefOpts(b.chefId)}</select></label>
      <span class="bx">${confirmed[b.id] ? `<span class="badge ok" title="Has confirmed seats">${confirmed[b.id]} confirmed</span>` : `<button type="button" class="btn xs ghost" data-del aria-label="Remove batch">Remove</button>`}</span></div>`).join('')
      || '<p class="small muted">No batches yet. Use quick add above.</p>';
    $('#batch-count').textContent = batches.length ? `${batches.length} batches · ${batches.reduce((n, b) => n + Number(b.seats || 0), 0)} spots` : '';
    $$('#batch-rows .brow').forEach((tr) => {
      const b = batches[+tr.dataset.i];
      $$('[data-k]', tr).forEach((inp) => (inp.onchange = () => { const k = inp.dataset.k; b[k] = k === 'seats' || k === 'price' ? (inp.value === '' ? null : Number(inp.value)) : inp.value; if (k === 'date' || k === 'time') paintBatches(); }));
      const del = $('[data-del]', tr); if (del) del.onclick = () => { batches.splice(+tr.dataset.i, 1); paintBatches(); };
    });
  };
  paintBatches();

  const days = new Set();
  const paintDays = () => { $('#g-days').innerHTML = [...days].sort().map((d) => `<button type="button" class="chip" data-day="${d}">${esc(fmtDate(d))} ✕</button>`).join(''); $$('[data-day]').forEach((c) => (c.onclick = () => { days.delete(c.dataset.day); paintDays(); })); };
  $('#g-add-day').onclick = () => { const d = $('#g-date').value; if (!d) return toast('Pick a date first'); days.add(d); $('#g-date').value = ''; paintDays(); };
  $('#g-date').onchange = () => $('#g-add-day').click();
  $('#g-go').onclick = () => {
    const times = $('#g-times').value.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean).map((t) => (/^\d{1,2}$/.test(t) ? `${t.padStart(2, '0')}:00` : t.padStart(5, '0')));
    if (!days.size) return toast('Add at least one day', { bad: true });
    if (!times.length || times.some((t) => !/^\d{2}:\d{2}$/.test(t))) return toast('Enter start times like 11:00, 16:00', { bad: true });
    const seats = Number($('#g-seats').value) || 8, price = $('#g-price').value === '' ? null : Number($('#g-price').value), chefId = $('#g-chef').value;
    let added = 0;
    for (const d of days) for (const t of times) {
      if (batches.some((b) => b.date === d && b.time === t)) continue;
      batches.push({ id: uid(6), date: d, time: t, seats, price, chefId }); added++;
    }
    days.clear(); paintDays(); paintBatches();
    toast(added ? `${added} batch${added > 1 ? 'es' : ''} added` : 'Those batches already exist');
  };
  $('#add-batch').onclick = () => {
    const last = batches.at(-1);
    batches.push({ id: uid(6), date: last?.date || todayStr(), time: last?.time || '11:00', seats: last?.seats || 8, price: last?.price ?? null, chefId: last?.chefId || '' });
    paintBatches();
  };
  f.chefId.onchange = paintBatches;

  if (id) $('#del-ev').onclick = async () => {
    const bk = (await store.listBookings(id)).length;
    if (!(await confirmBox('Delete this workshop?', bk ? `It has ${bk} booking(s). They'll stay in the database but the event page will disappear.` : 'This can\'t be undone.', { ok: 'Delete', danger: true }))) return;
    await store.deleteEvent(id); toast('Workshop deleted'); location.hash = '#/admin/events';
  };

  f.onsubmit = async (e) => {
    e.preventDefault();
    let bad = false;
    if (!f.title.value.trim()) { setFieldError(f.title.closest('.field'), 'Give the workshop a title'); bad = true; }
    if (!f.chefId.value) { setFieldError(f.chefId.closest('.field'), 'Add a chef in the Chefs tab first'); bad = true; }
    const batchErr = !batches.length ? 'Add at least one batch' : batches.some((b) => !b.date || !b.time || !(b.seats > 0)) ? 'Every batch needs a date, start time and spots' : '';
    setFieldError($('#batch-err'), batchErr); if (batchErr) bad = true;
    if (f.published.checked && !imageUrl) { toast('Add a background image before publishing', { bad: true }); bad = true; }
    if (bad) return;
    const lead = f.chefId.value;
    const data = {
      ...(id ? { id } : {}),
      title: f.title.value.trim(), tagline: f.tagline.value.trim(), description: f.description.value.trim(),
      includes: f.includes.value.split('\n').map((s) => s.trim()).filter(Boolean), imageUrl, chefId: lead,
      durationMins: Number(f.dh.value) * 60 + Number(f.dm.value), price: Number(f.price.value) || 0,
      venue: { name: f.vname.value.trim(), address: f.vaddr.value.trim(), mapsUrl: f.vmaps.value.trim() },
      batches: batches.map((b) => ({ id: b.id, date: b.date, time: b.time, seats: Number(b.seats), price: b.price === '' || b.price == null ? Number(f.price.value) || 0 : Number(b.price), chefId: b.chefId || lead })),
      status: f.published.checked ? 'published' : 'draft', featured: f.featured.checked,
    };
    const btn = $('button[type=submit]', f); btn.disabled = true;
    try {
      if (data.featured) for (const other of (await store.listEvents({ all: true })).filter((x) => x.featured && x.id !== id)) await store.patchEvent(other.id, { featured: false });
      const newId = await store.saveEvent(data);
      toast(id ? 'Workshop saved' : 'Workshop created');
      location.hash = `#/admin/event/${newId}`; if (id) viewEventEditor(newId);
    } catch (err) { btn.disabled = false; toast(err.message, { bad: true }); }
  };
}

// ---------- bookings ----------
async function viewBookings(eventId, params) {
  showLoading();
  const events = (await store.listEvents({ all: true })).sort((a, b) => (isPast(a) - isPast(b)) || (sortBatches(a.batches)[0]?.date || '').localeCompare(sortBatches(b.batches)[0]?.date || ''));
  if (!events.length) return shell('bookings', '<section class="glass card empty"><p>No workshops yet.</p><a class="btn sm" href="#/admin/event/new">Create one</a></section>');
  const ev = events.find((e) => e.id === eventId) || events[0];
  const [bookings, chefs] = await Promise.all([store.listBookings(ev.id), chefMap()]);
  const filter = params.get('f') || 'all', batchF = params.get('b') || '', q = (params.get('q') || '').toLowerCase();
  const setParam = (k, v) => { const p = new URLSearchParams(params); v ? p.set(k, v) : p.delete(k); location.hash = `#/admin/bookings/${ev.id}?${p}`; };

  const seats = (ev.batches || []).reduce((n, b) => n + Number(b.seats || 0), 0);
  const conf = bookings.filter((b) => b.status === 'confirmed').length;
  const wait = bookings.filter((b) => b.status === 'waitlist').length;
  const shown = bookings.filter((b) =>
    (filter === 'all' ? b.status !== 'cancelled' : filter === 'asked' ? b.status === 'waitlist' && b.paymentRequestedAt : filter === 'new' ? b.status === 'waitlist' && !b.paymentRequestedAt : b.status === filter)
    && (!batchF || b.batchId === batchF)
    && (!q || [b.name, b.phone, b.email, b.ref].join(' ').toLowerCase().includes(q)));

  const groups = sortBatches(ev.batches).map((bt) => ({ bt, list: shown.filter((b) => b.batchId === bt.id).sort((a, b) => (a.status === 'confirmed' ? 0 : 1) - (b.status === 'confirmed' ? 0 : 1) || (a.spot || 0) - (b.spot || 0) || a.createdAt - b.createdAt) })).filter((g) => g.list.length);
  const orphans = shown.filter((b) => !(ev.batches || []).some((bt) => bt.id === b.batchId));

  const card = (b) => {
    const badge = b.status === 'confirmed' ? `<span class="badge ok">Seat #${b.spot}</span>` : b.status === 'cancelled' ? '<span class="badge bad">Cancelled</span>' : b.paymentRequestedAt ? '<span class="badge wait">Payment asked</span>' : '<span class="badge gold">New</span>';
    const acts = b.status === 'waitlist'
      ? `<a class="btn xs wa" href="${esc(waLink(b.whatsapp, msg('payment', b, ev)))}" target="_blank" rel="noopener" data-ask="${b.id}">${b.paymentRequestedAt ? 'Ask payment again' : 'Ask for payment'}</a>
         <button class="btn xs gold" data-confirm="${b.id}">Payment received · confirm seat</button>
         <button class="btn xs ghost" data-move="${b.id}">Move</button><button class="btn xs ghost" data-cancel="${b.id}">Cancel</button>`
      : b.status === 'confirmed'
        ? `<a class="btn xs wa" href="${esc(waLink(b.whatsapp, msg('confirmed', b, ev)))}" target="_blank" rel="noopener" data-sent="${b.id}">Send confirmation</a>
           <a class="btn xs ghost" href="${esc(waLink(b.whatsapp, msg('reminder', b, ev)))}" target="_blank" rel="noopener" data-remind="${b.id}">Reminder</a>
           <button class="btn xs ghost" data-move="${b.id}">Move</button><button class="btn xs ghost" data-unconfirm="${b.id}">Back to waitlist</button><button class="btn xs ghost" data-cancel="${b.id}">Cancel</button>`
        : `<button class="btn xs ghost" data-restore="${b.id}">Restore to waitlist</button><button class="btn xs danger" data-delete="${b.id}">Delete</button>`;
    const trail = [b.paymentRequestedAt && `asked ${timeAgo(b.paymentRequestedAt)}`, b.confirmedAt && `confirmed ${timeAgo(b.confirmedAt)}`, b.confirmSentAt && 'confirmation sent', b.remindedAt && 'reminded'].filter(Boolean).join(' · ');
    return `<div class="bk">
      <div class="top"><div class="grow" style="flex:1;min-width:0"><div class="flex wrap-gap" style="gap:8px"><span class="name">${esc(b.name)}</span>${badge}<span class="tiny muted">${esc(b.ref)} · joined ${timeAgo(b.createdAt)}</span></div>
      <div class="contact"><a href="tel:+${esc(b.phone)}">${esc(prettyPhone(b.phone))}</a>${b.whatsapp !== b.phone ? ` · WA <a href="https://wa.me/${esc(b.whatsapp)}" target="_blank">${esc(prettyPhone(b.whatsapp))}</a>` : ' · WhatsApp same'} · <a href="mailto:${esc(b.email)}">${esc(b.email)}</a></div>
      ${trail ? `<div class="tiny muted" style="margin-top:2px">${esc(trail)}</div>` : ''}</div></div>
      <div class="actions">${acts}</div></div>`;
  };

  shell('bookings', `
    <div class="adm-head"><div class="field" style="margin:0;flex:1;min-width:240px"><select id="ev-pick">${events.map((e) => `<option value="${esc(e.id)}" ${e.id === ev.id ? 'selected' : ''}>${esc(e.title)} · ${esc(dateRange(e))}${isPast(e) ? ' (past)' : ''}</option>`).join('')}</select></div>
      <div class="flex"><button class="btn xs ghost" id="csv">Export CSV</button><a class="btn xs ghost" href="#/admin/event/${esc(ev.id)}">Edit event</a></div></div>
    <div class="kpis"><div class="kpi glass"><b>${wait}</b><span>Waitlist</span></div><div class="kpi glass"><b>${conf}<span style="font-size:.9rem;letter-spacing:0;font-family:var(--sans)"> / ${seats}</span></b><span>Confirmed</span></div><div class="kpi glass"><b>${Math.max(0, seats - conf)}</b><span>Spots left</span></div></div>
    <div class="filters">${[['all', 'All active'], ['new', 'New'], ['asked', 'Payment asked'], ['confirmed', 'Confirmed'], ['cancelled', 'Cancelled']].map(([k, l]) => `<button data-f="${k}" class="${filter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="row2" style="margin-bottom:14px">
      <div class="field" style="margin:0"><select id="batch-f"><option value="">All batches</option>${sortBatches(ev.batches).map((bt) => `<option value="${esc(bt.id)}" ${bt.id === batchF ? 'selected' : ''}>Batch ${batchIndex(ev, bt)} · ${esc(batchLabel(bt))}</option>`).join('')}</select></div>
      <div class="field" style="margin:0"><input type="text" id="q" placeholder="Search name, phone, ref" value="${esc(params.get('q') || '')}"></div>
    </div>
    ${groups.map(({ bt, list }) => {
      const c = (ev.confirmed || {})[bt.id] || 0; const ch = chefs[bt.chefId || ev.chefId];
      return `<section class="glass" style="overflow:hidden;margin-bottom:14px"><div class="batch-head"><span>Batch ${batchIndex(ev, bt)} · ${esc(batchLabel(bt))}${ch ? ' · ' + esc(ch.name) : ''}</span><span>${c}/${bt.seats} · ${fmtPrice(batchPrice(ev, bt))}</span></div>${list.map(card).join('')}</section>`;
    }).join('')}
    ${orphans.length ? `<section class="glass" style="overflow:hidden;margin-bottom:14px"><div class="batch-head"><span>Batch removed from event · move these people</span></div>${orphans.map(card).join('')}</section>` : ''}
    ${!groups.length && !orphans.length ? '<section class="glass card empty"><div class="sym">◎</div><p class="muted">No bookings match.</p></section>' : ''}
  `);

  $('#ev-pick').onchange = (e) => (location.hash = `#/admin/bookings/${e.target.value}`);
  $('#batch-f').onchange = (e) => setParam('b', e.target.value);
  $$('[data-f]').forEach((b) => (b.onclick = () => setParam('f', b.dataset.f === 'all' ? '' : b.dataset.f)));
  let qt; $('#q').oninput = (e) => { clearTimeout(qt); qt = setTimeout(() => setParam('q', e.target.value.trim()), 500); };
  $('#csv').onclick = () => exportCsv(ev, bookings);

  const find = (id) => bookings.find((b) => b.id === id);
  const refresh = () => viewBookings(ev.id, params);
  const stamp = (attr, field) => $$(`[${attr}]`).forEach((a) => a.addEventListener('click', () => store.updateBooking(a.getAttribute(attr), { [field]: Date.now() }).then(() => setTimeout(refresh, 400))));
  stamp('data-ask', 'paymentRequestedAt'); stamp('data-sent', 'confirmSentAt'); stamp('data-remind', 'remindedAt');

  $$('[data-confirm]').forEach((btn) => (btn.onclick = async () => {
    const b = find(btn.dataset.confirm); const bt = ev.batches.find((x) => x.id === b.batchId);
    if (!bt) return toast('Move this person to an existing batch first', { bad: true });
    const spot = nextSpot(bookings, b.batchId, b.id);
    const full = seatsLeft(ev, bt) === 0;
    if (!(await confirmBox(full ? 'This batch is already full' : 'Payment received?',
      `${full ? `Batch ${batchIndex(ev, bt)} has all ${bt.seats} spots confirmed. Confirming will overbook it.\n\n` : ''}Confirm ${b.name} for Batch ${batchIndex(ev, bt)} (${batchLabel(bt)}) as Seat #${spot}?\n\nOnly do this after you've checked the payment screenshot.`,
      { ok: full ? 'Overbook and confirm' : `Confirm seat #${spot}` }))) return;
    await store.updateBooking(b.id, { status: 'confirmed', spot, confirmedAt: Date.now() });
    b.status = 'confirmed'; b.spot = spot;
    await syncCounts(ev.id, bookings); ev.confirmed = (await store.getEvent(ev.id)).confirmed;
    const s = openSheet(`<div class="success"><div class="sym">✓</div><h2 style="font-weight:300;font-size:1.5rem;margin:0 0 4px">Seat #${spot} confirmed</h2>
      <p class="muted small">${esc(b.name)} · Batch ${batchIndex(ev, bt)} · ${esc(batchLabel(bt))}</p><div class="spacer"></div>
      <a class="btn wa block" href="${esc(waLink(b.whatsapp, msg('confirmed', b, ev)))}" target="_blank" rel="noopener" id="send-conf">Send confirmation on WhatsApp</a><div class="spacer"></div>
      <button class="btn ghost block" data-close>Later</button></div>`, { center: true, onClose: refresh });
    $('#send-conf', s.el).addEventListener('click', () => { store.updateBooking(b.id, { confirmSentAt: Date.now() }); setTimeout(s.close, 300); });
  }));

  $$('[data-unconfirm]').forEach((btn) => (btn.onclick = async () => {
    const b = find(btn.dataset.unconfirm);
    if (!(await confirmBox('Move back to waitlist?', `${b.name} will lose Seat #${b.spot}.`, { ok: 'Move to waitlist' }))) return;
    await store.updateBooking(b.id, { status: 'waitlist', spot: null, confirmedAt: null }); b.status = 'waitlist';
    await syncCounts(ev.id, bookings); refresh();
  }));
  $$('[data-cancel]').forEach((btn) => (btn.onclick = async () => {
    const b = find(btn.dataset.cancel);
    if (!(await confirmBox('Cancel this booking?', `${b.name}${b.spot ? ` (Seat #${b.spot})` : ''} will be marked cancelled. No message is sent.`, { ok: 'Cancel booking', danger: true }))) return;
    await store.updateBooking(b.id, { status: 'cancelled', spot: null, cancelledAt: Date.now() }); b.status = 'cancelled';
    await syncCounts(ev.id, bookings); refresh();
  }));
  $$('[data-restore]').forEach((btn) => (btn.onclick = async () => { await store.updateBooking(btn.dataset.restore, { status: 'waitlist', cancelledAt: null }); refresh(); }));
  $$('[data-delete]').forEach((btn) => (btn.onclick = async () => {
    if (!(await confirmBox('Delete permanently?', 'This removes the booking record completely.', { ok: 'Delete', danger: true }))) return;
    await store.deleteBooking(btn.dataset.delete); refresh();
  }));
  $$('[data-move]').forEach((btn) => (btn.onclick = () => {
    const b = find(btn.dataset.move);
    const opts = sortBatches(ev.batches).filter((bt) => bt.id !== b.batchId).map((bt) => `<option value="${esc(bt.id)}">Batch ${batchIndex(ev, bt)} · ${esc(batchLabel(bt))} · ${seatsLeft(ev, bt)} left</option>`).join('');
    if (!opts) return toast('There is no other batch to move to');
    const s = openSheet(`<h2 style="font-weight:300;font-size:1.3rem;margin:4px 0 6px">Move ${esc(b.name)}</h2>
      <p class="muted small" style="margin:0 0 14px">${b.status === 'confirmed' ? 'They stay confirmed and get a new seat number in the new batch.' : 'They stay on the waitlist in the new batch.'}</p>
      <div class="field"><select id="mv">${opts}</select></div><div class="row2"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="mv-go">Move</button></div>`, { center: true });
    $('#mv-go', s.el).onclick = async () => {
      const to = $('#mv', s.el).value; const patch = { batchId: to };
      const tb = ev.batches.find((x) => x.id === to); Object.assign(patch, { batchDate: tb.date, batchTime: tb.time });
      if (b.status === 'confirmed') patch.spot = nextSpot(bookings, to, b.id);
      await store.updateBooking(b.id, patch); Object.assign(b, patch);
      await syncCounts(ev.id, bookings); s.close();
      toast(b.status === 'confirmed' ? `Moved. New seat #${patch.spot}. Send them the updated confirmation.` : 'Moved');
      refresh();
    };
  }));
}

function exportCsv(ev, bookings) {
  const rows = [['Ref', 'Name', 'Phone', 'WhatsApp', 'Email', 'Batch', 'Date', 'Time', 'Status', 'Seat', 'Joined', 'Payment asked', 'Confirmed']];
  sortBatches(ev.batches).forEach((bt) => bookings.filter((b) => b.batchId === bt.id).forEach((b) => rows.push([
    b.ref, b.name, '+' + b.phone, '+' + b.whatsapp, b.email, batchIndex(ev, bt), bt.date, bt.time, b.status, b.spot || '',
    new Date(b.createdAt).toLocaleString('en-IN'), b.paymentRequestedAt ? new Date(b.paymentRequestedAt).toLocaleString('en-IN') : '', b.confirmedAt ? new Date(b.confirmedAt).toLocaleString('en-IN') : '',
  ])));
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `${ev.title.replace(/\W+/g, '-').toLowerCase()}-bookings.csv`; a.click();
}

// ---------- chefs ----------
async function viewChefs() {
  showLoading();
  const [chefs, invites] = await Promise.all([store.listChefs(), store.listInvites()]);
  const emailOf = Object.fromEntries(invites.map((i) => [i.chefId, i]));
  shell('chefs', `
    <div class="adm-head"><h1 class="h-title">Chefs</h1><button class="btn gold sm" id="add-chef">＋ Add chef</button></div>
    ${chefs.length ? `<section class="glass" style="padding:4px 0">${chefs.sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<a class="list-row" href="#/admin/chefs/${esc(c.id)}" style="text-decoration:none;color:inherit">
      ${c.photoUrl ? `<img class="avatar" src="${esc(c.photoUrl)}" alt="">` : '<div class="avatar"></div>'}
      <div class="grow"><div class="title">${esc(c.name)}</div><div class="small muted">${esc(emailOf[c.id]?.email || 'no login')} · ${c.postCount || 0}/${MAX_POSTS_PER_CHEF} posts</div></div>
      ${c.blocked ? '<span class="badge bad">Blocked</span>' : '<span class="badge ok">Active</span>'}<span class="muted">›</span></a>`).join('')}</section>`
      : '<section class="glass card empty"><div class="sym">✦</div><p>Add your first chef. They\'ll get an email invite to set up their profile.</p></section>'}`);
  $('#add-chef').onclick = () => {
    const s = openSheet(`<div class="sheet-head"><div><div class="eyebrow">New chef</div><h2>Invite a chef</h2></div><button class="icon-btn glass" data-close aria-label="Close">✕</button></div>
      <form id="nc" novalidate>
        <div class="field"><label>Name <span class="req">*</span></label><input type="text" name="name" placeholder="Chef Aarav Mehta"><div class="err-msg"></div></div>
        <div class="field"><label>Email <span class="req">*</span></label><input type="email" name="email" placeholder="chef@gmail.com"><div class="err-msg"></div><div class="hint">They'll get an invite link here to set their password and build their profile.</div></div>
        <div class="field"><label>Title</label><input type="text" name="title" placeholder="Italian cuisine · Fresh pasta"></div>
        <button class="btn block" type="submit">Add and send invite</button></form>`);
    const f = $('#nc', s.el);
    f.onsubmit = async (e) => {
      e.preventDefault(); let bad = false;
      if (!f.name.value.trim()) { setFieldError(f.name.closest('.field'), 'Enter a name'); bad = true; }
      if (!validEmail(f.email.value)) { setFieldError(f.email.closest('.field'), 'Enter a valid email'); bad = true; }
      if (bad) return;
      const btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'Adding…';
      try {
        const id = await store.createChef({ name: f.name.value.trim(), email: f.email.value, title: f.title.value.trim() });
        await store.sendInvite(f.email.value);
        s.close(); toast(isDemo ? 'Chef added. Demo mode doesn\'t send emails; they can sign in at Chef login with this email.' : 'Chef added and invite emailed', { ms: 6000 });
        location.hash = `#/admin/chefs/${id}`;
      } catch (err) { btn.disabled = false; btn.textContent = 'Add and send invite'; toast(err.message, { bad: true }); }
    };
  };
}

async function viewChefAdmin(id) {
  showLoading();
  const [chef, posts, invites] = await Promise.all([store.getChef(id), store.listPosts(id, { all: true }), store.listInvites()]);
  if (!chef) return shell('chefs', '<section class="glass card empty"><p>Chef not found.</p></section>');
  const inv = invites.find((i) => i.chefId === id);
  shell('chefs', `
    <div class="adm-head"><div><a class="tiny muted" href="#/admin/chefs">‹ Chefs</a><h1 class="h-title">${esc(chef.name)}</h1></div><a class="btn xs ghost" href="#/c/${esc(id)}" target="_blank">Public profile ↗</a></div>
    <section class="glass card">
      <label class="flex between"><span><b>Block this profile</b><br><span class="small muted">Hides the profile and gallery from the public. The chef sees "Your profile has been blocked by Heebee" when they sign in.</span></span>
        <span class="switch danger"><input type="checkbox" id="blk" ${chef.blocked ? 'checked' : ''}><span></span></span></label>
      <hr class="rule">
      <div class="flex between wrap-gap"><span class="small">Login: <b>${esc(inv?.email || 'none')}</b>${inv?.invitedAt ? ` · invited ${timeAgo(inv.invitedAt)}` : ''}</span>${inv ? '<button class="btn xs ghost" id="resend">Resend invite</button>' : ''}</div>
    </section>
    <div class="label" style="margin-top:22px">Posts · ${posts.length}/${MAX_POSTS_PER_CHEF}</div>
    ${posts.length ? `<div class="gallery">${posts.map((p) => `<div class="tile ${p.hidden ? 'hidden-post' : ''}"><img src="${esc(p.imageUrl)}" alt="" data-view="${esc(p.id)}" style="cursor:zoom-in">
      ${p.hidden ? '<span class="badge bad tile-badge">Hidden</span>' : ''}
      <div class="tile-actions"><button class="btn xs ${p.hidden ? 'white' : 'glassy'}" data-hide="${esc(p.id)}">${p.hidden ? 'Unhide' : 'Hide'}</button></div></div>`).join('')}</div>`
      : '<section class="glass card empty"><p class="muted small">No posts yet.</p></section>'}
    <div class="label" style="margin-top:22px">Profile</div>
    <div id="pf"></div>
    <div class="spacer"></div><button class="btn sm danger" id="del-chef">Delete chef</button>`);
  $('#blk').onchange = async (e) => {
    await store.saveChef({ id, blocked: e.target.checked });
    toast(e.target.checked ? 'Profile blocked' : 'Profile unblocked');
  };
  $('#resend')?.addEventListener('click', async () => { try { await store.sendInvite(inv.email); toast(isDemo ? 'Demo mode: no email sent' : 'Invite sent again'); } catch (err) { toast(err.message, { bad: true }); } });
  $$('[data-hide]').forEach((b) => (b.onclick = async () => { const p = posts.find((x) => x.id === b.dataset.hide); await store.updatePost(id, p.id, { hidden: !p.hidden }); toast(p.hidden ? 'Post visible again' : 'Post hidden from public'); viewChefAdmin(id); }));
  $$('[data-view]').forEach((im) => (im.onclick = () => { const p = posts.find((x) => x.id === im.dataset.view); lightbox(p.imageUrl, p.caption); }));
  profileForm($('#pf'), chef, async (patch) => { await store.saveChef({ id, ...patch }); toast('Profile saved'); });
  $('#del-chef').onclick = async () => {
    const evs = (await store.listEvents({ all: true })).filter((e) => e.chefId === id || (e.batches || []).some((b) => b.chefId === id));
    if (evs.length) return toast(`This chef hosts ${evs.length} workshop(s). Change the chef on those first, or block the profile instead.`, { bad: true, ms: 6000 });
    if (!(await confirmBox('Delete chef?', 'Their profile and login link will be removed. Their photos stay in storage.', { ok: 'Delete', danger: true }))) return;
    await store.deleteChef(id); toast('Chef deleted'); location.hash = '#/admin/chefs';
  };
}

// ---------- stay updated ----------
async function viewUpdates() {
  showLoading();
  const [ups, events] = await Promise.all([store.listUpdates(), store.listEvents({ all: true })]);
  const evById = Object.fromEntries(events.map((e) => [e.id, e]));
  const groups = {};
  ups.sort((a, b) => b.createdAt - a.createdAt).forEach((u) => (groups[u.eventId] ||= []).push(u));
  shell('updates', `
    <div class="adm-head"><div><h1 class="h-title">Stay updated</h1><p class="muted small" style="margin:4px 0 0">People who asked to hear when a past workshop is back. Add new batches to the workshop, then send each person the relaunch message.</p></div></div>
    ${Object.keys(groups).length ? Object.entries(groups).map(([eid, list]) => {
      const ev = evById[eid]; const live = ev && !isPast(ev) && ev.status === 'published';
      return `<section class="glass" style="overflow:hidden;margin-bottom:14px"><div class="batch-head"><span>${esc(ev?.title || list[0].eventTitle || 'Removed workshop')}</span><span>${live ? '<span class="badge ok">New batches live</span>' : '<span class="badge neutral">No new batches yet</span>'}</span></div>
        ${list.map((u) => `<div class="bk"><div class="flex between wrap-gap"><div><span class="name">${esc(u.name)}</span> <span class="tiny muted">${esc(prettyPhone(u.whatsapp))} · ${timeAgo(u.createdAt)}</span>${u.notifiedAt ? ` <span class="badge ok">Sent ${timeAgo(u.notifiedAt)}</span>` : ''}</div>
          <div class="flex" style="gap:6px">${ev ? `<a class="btn xs ${live ? 'wa' : 'ghost'}" href="${esc(waLink(u.whatsapp, fillTemplate(state.settings.templates.relaunch, { name: u.name.split(' ')[0], event: ev.title, link: `${siteUrl()}#/e/${ev.id}` })))}" target="_blank" rel="noopener" data-notify="${esc(u.id)}">Send relaunch</a>` : ''}<button class="btn xs ghost" data-rm="${esc(u.id)}" aria-label="Remove">✕</button></div></div></div>`).join('')}</section>`;
    }).join('') : '<section class="glass card empty"><div class="sym">◎</div><p class="muted">No sign-ups yet. They appear when people tap "Keep me updated" on a past workshop.</p></section>'}`);
  $$('[data-notify]').forEach((a) => a.addEventListener('click', () => store.updateUpdate(a.dataset.notify, { notifiedAt: Date.now() }).then(() => setTimeout(viewUpdates, 500))));
  $$('[data-rm]').forEach((b) => (b.onclick = async () => { await store.deleteUpdate(b.dataset.rm); viewUpdates(); }));
}

// ---------- settings ----------
async function viewSettings() {
  const s = state.settings;
  shell('settings', `
    <div class="adm-head"><h1 class="h-title">Settings</h1></div>
    <form id="sf" novalidate>
    <section class="glass card"><div class="label">WhatsApp and payment</div>
      <div class="field"><label>Heebee WhatsApp number</label><input type="tel" name="whatsapp" value="${esc(s.whatsapp)}" placeholder="98765 43210"><div class="hint">Customers message this number and send payment screenshots to it. Open the one-tap messages on the phone logged in to this WhatsApp.</div></div>
      <div class="row2">
        <div class="field"><label>UPI ID</label><input type="text" name="upiId" value="${esc(s.upiId)}" placeholder="heebee@okhdfcbank"></div>
        <div class="field"><label>Payee name</label><input type="text" name="payeeName" value="${esc(s.payeeName)}" placeholder="Heebee Coffee"></div>
      </div>
      <div class="field"><label>UPI QR code image</label><div id="qr-up" style="max-width:240px">${uploadBox(s.qrUrl, 'Upload QR', 200)}</div><div class="hint">Shown on the payment page linked in the WhatsApp message.</div></div>
    </section>
    <section class="glass card"><div class="label">Terms, no-show and no-refund policy</div>
      <div class="field"><textarea name="policy" rows="14">${esc(s.policy)}</textarea><div class="hint">Customers must tick a box agreeing to this before joining the waitlist.</div></div>
    </section>
    <section class="glass card"><div class="label">WhatsApp message templates</div>
      <p class="tpl-vars">Placeholders: ${esc(TEMPLATE_VARS)}</p><p class="small" style="color:var(--warn);margin:0 0 14px">Don't use emojis here. WhatsApp turns emojis in pre-filled messages into "�". Use *bold*, ₹, · and ✦ instead.</p>
      ${[['payment', 'Payment request (sent to waitlist)'], ['confirmed', 'Seat confirmed'], ['reminder', 'Reminder before the workshop'], ['relaunch', 'Workshop is back (stay updated)']].map(([k, l]) => `<div class="field"><label>${l}</label><textarea name="tpl_${k}" rows="9">${esc(s.templates[k])}</textarea></div>`).join('')}
    </section>
    <div class="flex between wrap-gap">${isDemo ? '<button type="button" class="btn sm danger" id="reset-demo">Reset demo data</button>' : '<span></span>'}<button class="btn gold" type="submit">Save settings</button></div>
    </form>`, { wide: false });
  let qrUrl = s.qrUrl;
  wireUpload($('#qr-up .upload-drop'), 'settings', (u) => (qrUrl = u), 1200);
  const f = $('#sf');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const patch = {
      whatsapp: f.whatsapp.value.trim() ? (await import('./util.js?v=20261016123504')).normPhone(f.whatsapp.value) : '', upiId: f.upiId.value.trim(), payeeName: f.payeeName.value.trim(), qrUrl,
      policy: f.policy.value.trim(), templates: Object.fromEntries(['payment', 'confirmed', 'reminder', 'relaunch'].map((k) => [k, f['tpl_' + k].value])),
    };
    try { await store.saveSettings(patch); state.settings = await getSettings(); toast('Settings saved'); } catch (err) { toast(err.message, { bad: true }); }
  };
  $('#reset-demo')?.addEventListener('click', async () => {
    if (!(await confirmBox('Reset demo data?', 'All sample events, chefs and bookings in this browser go back to the starting state.', { ok: 'Reset', danger: true }))) return;
    store.resetDemo(); location.reload();
  });
}
