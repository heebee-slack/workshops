import { store, isDemo, getSettings, hasSession } from './store.js?v=20261016130232';
import { DEFAULT_SETTINGS } from './defaults.js?v=20261016130232';
import {
  esc, $, $$, fmtDate, fmtDateLong, fmtTime, fmtDuration, fmtPrice, sortBatches, upcomingBatches, isPast, seatsLeft, batchPrice, minPrice,
  nextBatch, firstOpenBatch, totalSeatsLeft, batchLabel, batchIndex, dateRange, validPhone, validEmail, normPhone, waLink, siteUrl,
  toast, openSheet, lightbox, setFieldError, copyText, shareLink, loading, ICON,
} from './util.js?v=20261016130232';

const app = $('#app');
export const state = { settings: null, user: null, navId: 0, soft: false };

// ---------- theme ----------
export function toggleTheme() {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('hbw-theme', root.dataset.theme); } catch {}
}
const themeBtn = () => `<button class="icon-btn glass" data-theme-toggle aria-label="Switch light or dark">◐</button>`;
export function wireCommon(root = app) { $$('[data-theme-toggle]', root).forEach((b) => (b.onclick = toggleTheme)); }

let loaderTimer;
export function render(html) {
  clearTimeout(loaderTimer);
  document.body.classList.remove('is-loading');
  const y = window.scrollY;
  app.innerHTML = (isDemo ? `<div class="demo-banner">Demo mode · sample data saved in this browser only · add Firebase keys in js/config.js?v=20261016130232 to go live</div>` : '') + `<div class="${state.soft ? '' : 'view-enter'}">${html}</div>`;
  wireCommon();
  window.scrollTo(0, state.soft ? y : 0);
}

// Keep the current screen and show a thin progress bar; only an empty app gets the full loader.
export function showLoading() {
  clearTimeout(loaderTimer);
  if (!app.firstElementChild) { app.innerHTML = `<div class="wrap">${loading()}</div>`; return; }
  loaderTimer = setTimeout(() => document.body.classList.add('is-loading'), 120);
}

// True while the user is still on the screen this view started rendering for.
export function navGuard() { const id = state.navId; return () => id === state.navId; }

const img = (src, cls = '', alt = '', eager = false) => (src ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">` : '');
const chefMap = async () => Object.fromEntries((await store.listChefs()).map((c) => [c.id, c]));

// ---------- home feed ----------
function eventCard(ev, chef, { featured = false, eager = false } = {}) {
  const past = isPast(ev);
  const nb = nextBatch(ev);
  const left = totalSeatsLeft(ev);
  const top = past
    ? `<span class="pill glass-photo">Ended</span><span class="pill glass-photo">${esc(dateRange(ev))}</span>`
    : `<span class="pill glass-photo">${esc(dateRange({ batches: upcomingBatches(ev) }))}</span><span class="pill glass-photo">${minPrice(ev) ? (new Set(ev.batches.map((b) => batchPrice(ev, b))).size > 1 ? 'from ' : '') + fmtPrice(minPrice(ev)) : 'Free'}</span>`;
  const meta = [chef && !chef.blocked ? chef.name : '', nb ? fmtTime(nb.time) : '', fmtDuration(ev.durationMins)].filter(Boolean).join(' · ');
  const action = past
    ? `<button class="btn white sm" data-updates="${esc(ev.id)}">Keep me updated</button>`
    : `<span class="btn white sm">${left ? 'Join waitlist' : 'View batches'}</span>`;
  return `<a class="ev-card ${featured ? 'featured' : 'compact'} ${past ? 'past' : ''}" href="#/e/${esc(ev.id)}">
    ${img(ev.imageUrl, 'bgimg', ev.title, eager)}
    <div class="top">${top}</div>
    <div class="panel glass-photo">
      ${featured ? '<div class="feature-tag">Next up at Heebee</div>' : ''}
      <h3>${esc(ev.title)}</h3>
      <p class="meta">${esc(meta)}</p>
      <div class="row"><span class="seats">${past ? 'Past workshop' : left ? `${left} spot${left > 1 ? 's' : ''} left` : 'All batches full · join waitlist'}</span>${action}</div>
    </div>
  </a>`;
}

async function viewHome() {
  showLoading(); const live = navGuard();
  const [events, chefs] = await Promise.all([store.listEvents(), chefMap()]);
  if (!live()) return;
  const upcoming = events.filter((e) => !isPast(e)).sort((a, b) => (nextBatch(a)?.date || '').localeCompare(nextBatch(b)?.date || '') || (nextBatch(a)?.time || '').localeCompare(nextBatch(b)?.time || ''));
  const past = events.filter(isPast).sort((a, b) => (sortBatches(b.batches).at(-1)?.date || '').localeCompare(sortBatches(a.batches).at(-1)?.date || ''));
  const featured = upcoming.find((e) => e.featured) || upcoming[0];
  const rest = upcoming.filter((e) => e !== featured);
  const wa = state.settings.whatsapp;
  render(`<div class="wrap">
    <div class="topbar"><span class="brand">Heebee</span>${themeBtn()}</div>
    <header class="hero-head"><div class="eyebrow">Learn · Cook · Taste</div><h1 class="h-display">Workshops</h1></header>
    ${featured ? eventCard(featured, chefs[featured.chefId], { featured: true, eager: true }) : `<div class="glass card empty"><div class="sym">✦</div><p>New workshops are being planned.</p><p class="muted small">Check back soon.</p></div>`}
    ${rest.length ? `<div class="label" style="margin-top:28px">Coming soon</div><div class="feed-grid">${rest.map((e) => eventCard(e, chefs[e.chefId])).join('')}</div>` : ''}
    ${past.length ? `<div class="label" style="margin-top:28px">Past workshops</div><div class="feed-grid">${past.map((e) => eventCard(e, chefs[e.chefId])).join('')}</div>` : ''}
    <footer class="foot">
      ${wa ? `<a class="btn glassy sm" href="${esc(waLink(wa, 'Hi Heebee! I have a question about the workshops.'))}" target="_blank" rel="noopener">Chat with us on WhatsApp</a><div class="spacer"></div>` : ''}
      <a href="#/chef">Chef login</a> · <a href="#/admin">Team</a>
    </footer>
  </div>`);
  $$('[data-updates]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); const ev = events.find((x) => x.id === b.dataset.updates); openUpdatesSheet(ev); }));
  // Warm the next screens: chef galleries and hero photos, while the phone is idle.
  (window.requestIdleCallback || setTimeout)(() => {
    for (const id of new Set(upcoming.map((e) => e.chefId).filter(Boolean))) store.listPosts(id).catch(() => {});
    upcoming.slice(0, 4).forEach((e) => { const c = chefs[e.chefId]; if (c?.photoUrl) new Image().src = c.photoUrl; });
  });
}

// ---------- event detail ----------
async function viewEvent(id, preselect) {
  showLoading(); const live = navGuard();
  const [ev, chefs] = await Promise.all([store.getEvent(id), chefMap()]);
  if (!live()) return;
  if (!ev || ev.status !== 'published' && !(state.user && state.isAdmin)) return viewNotFound('This workshop isn\'t available.');
  const chef = chefs[ev.chefId];
  const past = isPast(ev);
  const ups = upcomingBatches(ev);
  let sel = ups.find((b) => b.id === preselect && seatsLeft(ev, b) > 0) || firstOpenBatch(ev);

  const byDay = {};
  ups.forEach((b) => (byDay[b.date] ||= []).push(b));
  const multiPrice = new Set(ev.batches.map((b) => batchPrice(ev, b))).size > 1;
  const multiChef = new Set(ev.batches.map((b) => b.chefId || ev.chefId)).size > 1;
  const batchHtml = Object.entries(byDay).map(([d, list]) => `
    <div class="batch-day"><div class="label">${esc(fmtDateLong(d))}</div><div class="batch-grid">
    ${list.map((b) => {
      const left = seatsLeft(ev, b); const full = left === 0;
      const bc = chefs[b.chefId || ev.chefId];
      return `<button class="batch ${full ? 'full' : ''}" data-batch="${esc(b.id)}" ${full ? 'aria-disabled="true"' : ''}>
        <div class="t">${esc(fmtTime(b.time))}</div>
        <div class="s ${!full && left <= 3 ? 'low' : ''}">Batch ${batchIndex(ev, b)} · ${full ? 'Full' : `${left} of ${b.seats} left`}</div>
        ${multiPrice ? `<div class="p">${fmtPrice(batchPrice(ev, b))}</div>` : ''}
        ${multiChef && bc ? `<div class="s">${esc(bc.name)}</div>` : ''}
      </button>`;
    }).join('')}</div></div>`).join('');

  const v = ev.venue || {};
  render(`
    <div class="detail-hero">${img(ev.imageUrl, '', ev.title, true)}
      <div class="hero-nav"><a class="icon-btn glass-photo" href="#/" aria-label="Back">${ICON.back}</a><div class="flex">${themeBtn().replace('glass', 'glass-photo')}<button class="icon-btn glass-photo" data-share aria-label="Share">${ICON.share}</button></div></div>
    </div>
    <div class="wrap detail-body">
      <section class="glass detail-title">
        <div class="eyebrow">${past ? 'Past workshop' : esc(dateRange(ev))}</div>
        <h1 class="h-title">${esc(ev.title)}</h1>
        ${ev.tagline ? `<p class="muted" style="margin:0">${esc(ev.tagline)}</p>` : ''}
        <div class="chips">
          <span class="chip">⏱ ${esc(fmtDuration(ev.durationMins))}</span>
          ${v.name ? `<span class="chip">⌖ ${esc(v.name)}</span>` : ''}
          <span class="chip gold">${minPrice(ev) ? (multiPrice ? 'from ' : '') + fmtPrice(minPrice(ev)) : 'Free'}</span>
          ${!past ? `<span class="chip">◎ ${totalSeatsLeft(ev)} spots left</span>` : ''}
        </div>
      </section>

      ${chef && !chef.blocked ? `<a class="glass host-row card" href="#/c/${esc(chef.id)}">
        ${chef.photoUrl ? img(chef.photoUrl, 'avatar', chef.name) : '<div class="avatar"></div>'}
        <div><div class="label" style="margin:0 0 2px">Hosted by</div><div style="font-weight:700">${esc(chef.name)}</div><div class="muted small">${esc(chef.title || '')}</div></div>
        <span class="chev">›</span></a>` : ''}

      ${ev.description ? `<section class="glass card"><div class="label">About the workshop</div><p class="prose">${esc(ev.description)}</p></section>` : ''}
      ${(ev.includes || []).length ? `<section class="glass card"><div class="label">What's included</div><ul class="list-sym">${ev.includes.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>` : ''}

      ${past ? `<section class="glass card center"><div class="label">This workshop has ended</div><p class="muted small" style="margin:0 0 14px">Want to know when it's back? We'll WhatsApp you as soon as new batches open.</p><button class="btn block" data-updates>Keep me updated</button></section>`
        : `<section class="glass card" id="batches"><div class="label">Choose your batch</div>${batchHtml}<div id="next-hint"></div></section>`}

      ${v.name || v.address ? `<section class="glass card"><div class="label">Venue</div><div style="font-weight:700">${esc(v.name || '')}</div><div class="muted small">${esc(v.address || '')}</div>
        ${v.mapsUrl ? `<div class="spacer"></div><a class="btn glassy sm" href="${esc(v.mapsUrl)}" target="_blank" rel="noopener">Open in Maps</a>` : ''}</section>` : ''}

      <p class="center tiny muted">Bookings are non-refundable · <button class="linkish tiny" data-policy>Read the full policy</button></p>
    </div>
    ${past ? '' : `<div class="bottom-bar"><div class="inner glass"><div class="price" id="bb-price"></div><button class="btn gold" id="bb-join">Join waitlist</button></div></div>`}
  `);

  $('[data-share]').onclick = () => shareLink(ev.title, `${ev.title} at Heebee`, `${siteUrl()}#/e/${ev.id}`);
  $('[data-policy]').onclick = () => openPolicySheet();
  if (past) { $('[data-updates]').onclick = () => openUpdatesSheet(ev); return; }

  const paint = () => {
    $$('[data-batch]').forEach((b) => b.classList.toggle('sel', b.dataset.batch === sel?.id));
    const hint = $('#next-hint');
    const lastFull = [...ups].reverse().find((b) => seatsLeft(ev, b) === 0 && (!sel || b === ups[ups.indexOf(sel) - 1]));
    hint.innerHTML = !sel ? `<div class="next-hint">All batches are full right now. Join the waitlist and we'll message you if a spot opens up or we add a batch.</div>`
      : lastFull ? `<div class="next-hint">Batch ${batchIndex(ev, lastFull)} is full, so we've picked the next open one: Batch ${batchIndex(ev, sel)}, ${esc(batchLabel(sel))}.</div>` : '';
    $('#bb-price').innerHTML = sel ? `${fmtPrice(batchPrice(ev, sel))}<small>${esc(batchLabel(sel))}</small>` : `${fmtPrice(minPrice(ev))}<small>All batches full</small>`;
  };
  $$('[data-batch]').forEach((b) => (b.onclick = () => {
    const bt = ups.find((x) => x.id === b.dataset.batch);
    if (seatsLeft(ev, bt) === 0) {
      const nxt = firstOpenBatch(ev, bt);
      toast(nxt ? `Batch ${batchIndex(ev, bt)} is full. Try Batch ${batchIndex(ev, nxt)}, ${batchLabel(nxt)}.` : 'This batch is full');
      if (nxt) { sel = nxt; paint(); }
      return;
    }
    sel = bt; paint();
  }));
  $('#bb-join').onclick = () => openJoinSheet(ev, sel, chefs);
  paint();
}

// ---------- join waitlist ----------
function openJoinSheet(ev, batch, chefs) {
  const ups = upcomingBatches(ev);
  const options = ups.map((b) => { const l = seatsLeft(ev, b); return `<option value="${esc(b.id)}" ${b.id === batch?.id ? 'selected' : ''}>${esc(batchLabel(b))} · ${l ? `${l} left` : 'Full'}</option>`; }).join('');
  const s = openSheet(`
    <div class="sheet-head"><div><div class="eyebrow">Join the waitlist</div><h2>${esc(ev.title)}</h2></div><button class="icon-btn glass" data-close aria-label="Close">✕</button></div>
    <form id="join" novalidate>
      <div class="field"><label>Batch <span class="req">*</span></label><select name="batch">${options}</select><div class="hint" id="price-hint"></div></div>
      <div class="field"><label>Full name <span class="req">*</span></label><input type="text" name="name" autocomplete="name" placeholder="Riya Sharma"><div class="err-msg"></div></div>
      <div class="field"><label>Phone <span class="req">*</span></label><input type="tel" name="phone" autocomplete="tel" inputmode="tel" placeholder="98140 12345"><div class="err-msg"></div></div>
      <div class="field"><label>WhatsApp <span class="req">*</span></label><input type="tel" name="whatsapp" inputmode="tel" placeholder="98140 12345"><div class="err-msg"></div>
        <label class="check tiny"><input type="checkbox" name="same" checked> Same as phone</label></div>
      <div class="field"><label>Email <span class="req">*</span></label><input type="email" name="email" autocomplete="email" inputmode="email" placeholder="riya@gmail.com"><div class="err-msg"></div></div>
      <div class="field" id="tnc-field">
        <label class="check" id="tnc-label"><input type="checkbox" name="tnc"><span>I have read and agree to the <button type="button" class="linkish" data-toggle-policy>Terms, No-show and No-refund policy</button>. I understand this is a waitlist entry and my seat is confirmed only after payment is verified.</span></label>
        <div class="policy-box" id="policy-box"><p class="prose">${esc(state.settings.policy)}</p></div>
        <div class="err-msg"></div>
      </div>
      <button class="btn gold block" type="submit" id="join-submit">Join waitlist</button>
      <p class="center tiny muted" style="margin:10px 0 0">One seat per form. Coming with friends? Share the form with them after you join.</p>
    </form>`);
  const f = $('#join', s.el);
  const same = f.same, wa = f.whatsapp, phone = f.phone;
  const syncWa = () => { wa.disabled = same.checked; if (same.checked) wa.value = phone.value; wa.closest('.field').style.opacity = same.checked ? .6 : 1; };
  same.onchange = syncWa; phone.oninput = () => { syncWa(); setFieldError(phone.closest('.field')); };
  syncWa();
  const priceHint = () => { const b = ev.batches.find((x) => x.id === f.batch.value); const ch = chefs[b.chefId || ev.chefId]; $('#price-hint', s.el).textContent = `${fmtPrice(batchPrice(ev, b))} per person${ch && !ch.blocked ? ' · with ' + ch.name : ''}`; };
  f.batch.onchange = priceHint; priceHint();
  $('[data-toggle-policy]', s.el).onclick = (e) => { e.preventDefault(); $('#policy-box', s.el).classList.toggle('open'); };
  $$('input', f).forEach((i) => i.addEventListener('input', () => setFieldError(i.closest('.field'))));
  f.tnc.onchange = () => { setFieldError($('#tnc-field', s.el)); $('#tnc-label', s.el).classList.remove('err'); };

  f.onsubmit = async (e) => {
    e.preventDefault();
    const val = { name: f.name.value.trim(), phone: f.phone.value.trim(), whatsapp: (same.checked ? f.phone.value : f.whatsapp.value).trim(), email: f.email.value.trim() };
    let bad = null;
    const chk = (field, ok, msg) => { if (!ok) { setFieldError(f[field].closest('.field'), msg); bad ||= f[field]; } };
    chk('name', val.name.length >= 2, 'Enter your full name');
    chk('phone', validPhone(val.phone), 'Enter a valid 10-digit phone number');
    if (!same.checked) chk('whatsapp', validPhone(val.whatsapp), 'Enter a valid WhatsApp number');
    chk('email', validEmail(val.email), 'Enter a valid email address');
    if (!f.tnc.checked) { setFieldError($('#tnc-field', s.el), 'Please accept the policy to continue'); $('#tnc-label', s.el).classList.add('err'); bad ||= f.tnc; }
    if (bad) { bad.focus(); return; }
    const btn = $('#join-submit', s.el); btn.disabled = true; btn.textContent = 'Joining…';
    const b = ev.batches.find((x) => x.id === f.batch.value);
    try {
      const res = await store.createBooking({
        eventId: ev.id, eventTitle: ev.title, batchId: b.id, batchDate: b.date, batchTime: b.time,
        name: val.name, phone: normPhone(val.phone), whatsapp: normPhone(val.whatsapp), email: val.email.toLowerCase(), agreedAt: Date.now(),
      });
      showJoined(s, ev, b, res.ref, val.name);
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Join waitlist';
      toast(err.message || 'Could not join. Check your connection and try again.', { bad: true });
    }
  };
}

function showJoined(s, ev, b, ref, name) {
  const wa = state.settings.whatsapp;
  s.set(`<div class="success">
    <div class="sym">✦</div>
    <div class="eyebrow">Ref ${esc(ref)}</div>
    <h2 style="font-weight:300;font-size:1.6rem;margin:6px 0 4px">You're on the waitlist</h2>
    <p class="muted small" style="margin:0">${esc(ev.title)} · Batch ${batchIndex(ev, b)} · ${esc(batchLabel(b))}</p>
    <ol class="steps">
      <li>We'll WhatsApp you shortly with the payment details (UPI ID and QR).</li>
      <li>Pay ${esc(fmtPrice(batchPrice(ev, b)))} and send us the payment screenshot on the same chat.</li>
      <li>Once we verify it, you'll get a message confirming your seat number. See you there!</li>
    </ol>
    <button class="btn block" data-share-friend>Share with a friend</button>
    <div class="spacer"></div>
    ${wa ? `<a class="btn wa block" href="${esc(waLink(wa, `Hi Heebee! I just joined the waitlist for ${ev.title} (${batchLabel(b)}). My ref is ${ref}. Name: ${name}`))}" target="_blank" rel="noopener">Message us on WhatsApp</a><div class="spacer"></div>` : ''}
    <button class="btn ghost block" data-close>Done</button>
  </div>`);
  $('[data-share-friend]', s.el).onclick = () => shareLink(ev.title, `I just joined the waitlist for ${ev.title} at Heebee. Join me! Pick a batch and fill in your details here:`, `${siteUrl()}#/e/${ev.id}?b=${b.id}`);
}

export function openPolicySheet() {
  openSheet(`<div class="sheet-head"><h2>Terms and policy</h2><button class="icon-btn glass" data-close aria-label="Close">✕</button></div><p class="prose small">${esc(state.settings.policy)}</p>`);
}

function openUpdatesSheet(ev) {
  const s = openSheet(`
    <div class="sheet-head"><div><div class="eyebrow">Keep me updated</div><h2>${esc(ev.title)}</h2></div><button class="icon-btn glass" data-close aria-label="Close">✕</button></div>
    <p class="muted small" style="margin-top:-6px">We'll WhatsApp you when this workshop is back with new batches.</p>
    <form id="upd" novalidate>
      <div class="field"><label>Name <span class="req">*</span></label><input type="text" name="name" autocomplete="name" placeholder="Riya Sharma"><div class="err-msg"></div></div>
      <div class="field"><label>WhatsApp <span class="req">*</span></label><input type="tel" name="whatsapp" inputmode="tel" placeholder="98140 12345"><div class="err-msg"></div></div>
      <button class="btn block" type="submit">Notify me</button>
    </form>`);
  const f = $('#upd', s.el);
  $$('input', f).forEach((i) => i.addEventListener('input', () => setFieldError(i.closest('.field'))));
  f.onsubmit = async (e) => {
    e.preventDefault();
    let bad = false;
    if (f.name.value.trim().length < 2) { setFieldError(f.name.closest('.field'), 'Enter your name'); bad = true; }
    if (!validPhone(f.whatsapp.value)) { setFieldError(f.whatsapp.closest('.field'), 'Enter a valid WhatsApp number'); bad = true; }
    if (bad) return;
    try {
      await store.createUpdate({ eventId: ev.id, eventTitle: ev.title, name: f.name.value.trim(), whatsapp: normPhone(f.whatsapp.value) });
      s.set(`<div class="success"><div class="sym">✓</div><h2 style="font-weight:300;font-size:1.5rem;margin:0 0 6px">You're on the list</h2><p class="muted small">We'll message you on WhatsApp when ${esc(ev.title)} is back.</p><button class="btn block" data-close>Done</button></div>`);
    } catch (err) { toast(err.message, { bad: true }); }
  };
}

// ---------- chef profile ----------
async function viewChef(id) {
  showLoading(); const live = navGuard();
  const [chef, posts, events] = await Promise.all([store.getChef(id), store.listPosts(id), store.listEvents()]);
  if (!live()) return;
  if (!chef || chef.blocked) return viewNotFound('This profile isn\'t available right now.');
  const mine = events.filter((e) => e.chefId === id || (e.batches || []).some((b) => b.chefId === id));
  const upcoming = mine.filter((e) => !isPast(e));
  const past = mine.filter(isPast);
  const cover = chef.coverUrl || chef.photoUrl;
  const mini = (e) => `<a class="mini-ev" href="#/e/${esc(e.id)}">${img(e.imageUrl, '', e.title)}<div><div style="font-weight:700">${esc(e.title)}</div><div class="muted small">${esc(dateRange(e))}${isPast(e) ? '' : ' · ' + fmtPrice(minPrice(e))}</div></div></a>`;
  render(`
    <div class="chef-hero">${cover ? img(cover, 'cover', chef.name, true) : ''}
      <div class="hero-nav"><a class="icon-btn glass-photo" href="#/" data-back aria-label="Back">${ICON.back}</a><button class="icon-btn glass-photo" data-share aria-label="Share">${ICON.share}</button></div>
      <div class="panel glass-photo">${chef.photoUrl ? img(chef.photoUrl, 'avatar lg', chef.name) : ''}<div><div class="feature-tag">Chef at Heebee</div><h1>${esc(chef.name)}</h1><div class="small" style="opacity:.9">${esc(chef.title || '')}</div></div></div>
    </div>
    <div class="wrap" style="margin-top:14px">
      <section class="glass stats card"><div><b>${mine.length}</b><span>Workshops</span></div><div><b>${upcoming.length}</b><span>Upcoming</span></div><div><b>${posts.length}</b><span>Posts</span></div></section>
      ${chef.bio ? `<section class="glass card"><div class="label">About</div><p class="prose">${esc(chef.bio)}</p>${chef.instagram ? `<div class="spacer"></div><a class="btn glassy sm" href="${esc(chef.instagram)}" target="_blank" rel="noopener">Instagram ↗</a>` : ''}</section>` : ''}
      ${(chef.experience || []).length ? `<section class="glass card"><div class="label">Experience</div><ul class="timeline">${chef.experience.map((x) => `<li><div class="role">${esc(x.role)}</div><div class="where">${esc(x.place)}${x.years ? ' · ' + esc(x.years) : ''}</div></li>`).join('')}</ul></section>` : ''}
      ${(chef.achievements || []).length ? `<section class="glass card"><div class="label">Achievements</div><div class="ach">${chef.achievements.map((a) => `<span class="chip">✦ ${esc(a)}</span>`).join('')}</div></section>` : ''}
      ${upcoming.length ? `<section class="glass card"><div class="label">Upcoming workshops</div>${upcoming.map(mini).join('')}</section>` : ''}
      ${past.length ? `<section class="glass card"><div class="label">Past workshops</div>${past.map(mini).join('')}</section>` : ''}
      ${posts.length ? `<div class="label" style="margin-top:22px">Gallery</div><div class="gallery">${posts.map((p, i) => `<button data-post="${i}" aria-label="Open photo">${img(p.thumbUrl || p.imageUrl, '', p.caption)}</button>`).join('')}</div>` : ''}
    </div>`);
  $('[data-share]').onclick = () => shareLink(chef.name, `${chef.name} at Heebee`, `${siteUrl()}#/c/${chef.id}`);
  $('[data-back]').onclick = (e) => { if (history.length > 1) { e.preventDefault(); history.back(); } };
  $$('[data-post]').forEach((b) => (b.onclick = () => { const p = posts[+b.dataset.post]; lightbox(p.imageUrl, p.caption); }));
}

// ---------- pay page (linked from the WhatsApp payment message) ----------
function viewPay(params) {
  const s = state.settings;
  const am = Number(params.get('am')) || 0;
  const ref = (params.get('ref') || '').replace(/[^A-Z0-9-]/gi, '').slice(0, 12);
  const upi = s.upiId ? `upi://pay?pa=${encodeURIComponent(s.upiId)}&pn=${encodeURIComponent(s.payeeName || 'Heebee')}${am ? `&am=${am}` : ''}&cu=INR&tn=${encodeURIComponent('Workshop ' + ref)}` : '';
  render(`<div class="wrap">
    <div class="topbar"><a class="brand" href="#/" style="text-decoration:none">Heebee</a>${themeBtn()}</div>
    <section class="glass card center" style="margin-top:20px;padding:26px 20px">
      <div class="eyebrow">Workshop payment${ref ? ' · ' + esc(ref) : ''}</div>
      ${am ? `<div class="pay-amt">${fmtPrice(am)}</div>` : ''}
      <p class="muted small" style="margin:0">Pay to ${esc(s.payeeName || 'Heebee')}</p>
      ${s.qrUrl ? `<img class="qr" src="${esc(s.qrUrl)}" alt="UPI QR code">` : '<div class="spacer"></div>'}
      ${s.upiId ? `<div class="copy-row"><span>${esc(s.upiId)}</span><button class="btn xs ghost" data-copy>Copy</button></div><div class="spacer"></div>
      <a class="btn gold block" href="${esc(upi)}">Pay with a UPI app</a>` : '<p class="muted">Payment details will be shared on WhatsApp.</p>'}
      <ol class="steps"><li>Pay the exact amount using the QR or UPI ID above.</li><li>Take a screenshot of the successful payment.</li><li>Send it to us on WhatsApp. We'll confirm your seat after verifying it.</li></ol>
      ${s.whatsapp ? `<a class="btn wa block" href="${esc(waLink(s.whatsapp, `Hi Heebee, here is my payment screenshot for workshop booking ${ref}.`))}" target="_blank" rel="noopener">Send screenshot on WhatsApp</a>` : ''}
      <p class="tiny muted" style="margin:14px 0 0">Your seat is confirmed only after we verify the payment. Bookings are non-refundable.</p>
    </section></div>`);
  $('[data-copy]')?.addEventListener('click', () => copyText(s.upiId));
}

export function viewNotFound(msg = 'Page not found') {
  render(`<div class="wrap"><div class="topbar"><a class="brand" href="#/" style="text-decoration:none">Heebee</a>${themeBtn()}</div><div class="glass card empty" style="margin-top:30px"><div class="sym">◇</div><p>${esc(msg)}</p><a class="btn sm" href="#/">See all workshops</a></div></div>`);
}

// ---------- router ----------
async function route() {
  state.navId++;
  if (!state.soft) {
    document.querySelectorAll('.sheet-backdrop, .lightbox').forEach((n) => n.remove());
    document.body.classList.remove('modal-open');
  }
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  const params = new URLSearchParams(qs || '');
  const parts = path.split('/').filter(Boolean);
  try {
    if (needsAuth()) ensureAuth();
    if (store.isInviteLink()) { const m = await import('./chef.js?v=20261016130232'); return m.viewInvite(); }
    if (parts[0] === 'admin') { const m = await import('./admin.js?v=20261016130232'); return await m.routeAdmin(parts.slice(1), params); }
    if (parts[0] === 'chef') { const m = await import('./chef.js?v=20261016130232'); return m.routeChef(parts.slice(1)); }
    if (parts[0] === 'e' && parts[1]) return await viewEvent(parts[1], params.get('b'));
    if (parts[0] === 'c' && parts[1]) return await viewChef(parts[1]);
    if (parts[0] === 'pay') return viewPay(params);
    if (!parts.length) return await viewHome();
    viewNotFound();
  } catch (e) {
    if (e.stale) return;
    console.error(e);
    render(`<div class="wrap"><div class="glass card empty" style="margin-top:40px"><div class="sym">◇</div><p>Something went wrong loading this page.</p><p class="muted small">${esc(e.message)}</p><button class="btn sm" onclick="location.reload()">Try again</button></div></div>`);
  }
}

// Background data refresh found something new: quietly redraw the current screen,
// unless the user is typing, has a sheet open, or is on an editing screen.
function canSoftRefresh() {
  if (document.querySelector('.sheet-backdrop, .lightbox')) return false;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
  return !/^#\/(admin\/(event|settings|chefs\/)|chef)/.test(location.hash);
}
window.addEventListener('hbw-data', () => {
  if (!canSoftRefresh()) return;
  state.soft = true;
  route().finally(() => (state.soft = false));
});

const needsAuth = () => /^#\/(admin|chef)/.test(location.hash) || store.isInviteLink();

// The Firebase SDK (and the login check) only loads for admin/chef screens or an existing session.
let authStarted = false;
export function ensureAuth() {
  if (authStarted) return;
  authStarted = true;
  store.onAuth(async (u) => {
    state.user = u;
    const { ADMIN_EMAILS } = await import('./config.js?v=20261016130232');
    state.isAdmin = !!u && ADMIN_EMAILS.includes(u.email);
    const first = !state.authReady;
    state.authReady = true;
    if (first) { if (needsAuth()) route(); }
    else window.dispatchEvent(new Event('hbw-auth'));
  });
}

async function boot() {
  // Saved settings arrive instantly; on a first visit, draw with defaults and fill in when they land.
  const quick = await Promise.race([getSettings().catch(() => null), new Promise((r) => setTimeout(() => r(null), 0))]);
  state.settings = quick || { ...DEFAULT_SETTINGS };
  if (!quick) getSettings().then((s) => { state.settings = s; window.dispatchEvent(new Event('hbw-data')); }).catch(() => {});
  window.addEventListener('hashchange', route);
  if (needsAuth() || hasSession()) ensureAuth();
  if (!needsAuth()) route();
  if ('serviceWorker' in navigator && !/^(localhost|127\.)/.test(location.hostname)) navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
