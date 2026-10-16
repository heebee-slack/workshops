import { store, isDemo } from './store.js?v=20261016143556';
import { state, render, showLoading } from './app.js?v=20261016143556';
import { MAX_POSTS_PER_CHEF } from './config.js?v=20261016143556';
import { esc, $, $$, uid, resizeImage, toast, openSheet, confirmBox, setFieldError, loading, validEmail, lightbox, photo, previewOf, packImg, imgMeta } from './util.js?v=20261016143556';

const head = (right = '') => `<div class="topbar"><a class="brand" href="#/" style="text-decoration:none">Heebee</a><div class="flex">${right}</div></div>`;

let authHooked = false;
export async function routeChef() {
  if (!authHooked) { authHooked = true; window.addEventListener('hbw-auth', () => { if (location.hash.startsWith('#/chef')) routeChef(); }); }
  if (!state.authReady) return showLoading();
  if (!state.user) return viewLogin();
  showLoading();
  const chefId = await store.getChefIdForEmail(state.user.email).catch(() => null);
  if (!chefId) {
    return render(`<div class="wrap">${head()}<section class="glass card empty" style="margin-top:40px"><div class="sym">◇</div>
      <p>${esc(state.user.email)} isn't linked to a chef profile.</p>${state.isAdmin ? '<a class="btn sm" href="#/admin">Go to team admin</a> ' : ''}<button class="btn sm ghost" data-out>Sign out</button></section></div>`), wireOut();
  }
  const chef = await store.getChef(chefId);
  if (!chef) return render(`<div class="wrap">${head()}<section class="glass card empty"><p>Profile not found.</p></section></div>`);
  if (chef.blocked) {
    render(`<div class="wrap">${head()}<section class="glass card blocked-wall" style="margin-top:40px"><div class="sym">⊘</div>
      <h1 class="h-title" style="margin:10px 0 8px">Your profile has been blocked by the company</h1>
      <p class="muted small">Your profile and gallery are hidden from the public and you can't make changes right now. Please contact the Heebee team if you think this is a mistake.</p>
      <button class="btn sm ghost" data-out>Sign out</button></section></div>`);
    return wireOut();
  }
  return viewDashboard(chef);
}
const wireOut = () => $$('[data-out]').forEach((b) => (b.onclick = async () => { await store.signOut(); location.hash = '#/chef'; }));

function viewLogin() {
  render(`<div class="wrap" style="max-width:420px">${head()}
    <section class="glass card" style="margin-top:40px;padding:26px 22px">
      <div class="eyebrow">Chefs</div><h1 class="h-title" style="margin:6px 0 6px">Sign in</h1>
      <p class="muted small" style="margin:0 0 18px">New chef? Use the invite link Heebee emailed you to set your password.</p>
      <form id="cl" novalidate>
        <div class="field"><label>Email</label><input type="email" name="email" autocomplete="username"><div class="err-msg"></div></div>
        <div class="field"><label>Password</label><input type="password" name="password" autocomplete="current-password"><div class="err-msg"></div>
          ${isDemo ? '<div class="hint">Demo mode: try aarav@example.com, no password needed.</div>' : ''}</div>
        <button class="btn block" type="submit">Sign in</button>
      </form>
      ${isDemo ? '' : '<p class="center small" style="margin:14px 0 0"><button class="linkish small" id="forgot">Forgot password?</button></p>'}
    </section></div>`);
  const f = $('#cl');
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (!validEmail(f.email.value)) return setFieldError(f.email.closest('.field'), 'Enter your email');
    if (!isDemo && !f.password.value) return setFieldError(f.password.closest('.field'), 'Enter your password');
    const b = $('button[type=submit]', f); b.disabled = true;
    try { await store.signIn(f.email.value, f.password.value); }
    catch (err) { b.disabled = false; setFieldError(f.password.closest('.field'), err.message); }
  };
  $('#forgot')?.addEventListener('click', async () => {
    if (!validEmail(f.email.value)) return setFieldError(f.email.closest('.field'), 'Enter your email first');
    try { await store.resetPassword(f.email.value); toast('Password reset email sent'); } catch (err) { toast(err.message, { bad: true }); }
  });
}

// Landing page for the emailed invite link.
export function viewInvite() {
  render(`<div class="wrap" style="max-width:420px">${head()}
    <section class="glass card" style="margin-top:40px;padding:26px 22px">
      <div class="eyebrow">Welcome to Heebee</div><h1 class="h-title" style="margin:6px 0 6px">Set up your chef profile</h1>
      <p class="muted small" style="margin:0 0 18px">Confirm the email this invite was sent to and choose a password.</p>
      <form id="inv" novalidate>
        <div class="field"><label>Email</label><input type="email" name="email" autocomplete="username"><div class="err-msg"></div></div>
        <div class="field"><label>New password</label><input type="password" name="pw" autocomplete="new-password"><div class="err-msg"></div><div class="hint">At least 8 characters.</div></div>
        <div class="field"><label>Confirm password</label><input type="password" name="pw2" autocomplete="new-password"><div class="err-msg"></div></div>
        <button class="btn gold block" type="submit">Create my profile</button>
      </form></section></div>`);
  const f = $('#inv');
  f.onsubmit = async (e) => {
    e.preventDefault(); let bad = false;
    if (!validEmail(f.email.value)) { setFieldError(f.email.closest('.field'), 'Enter your email'); bad = true; }
    if (f.pw.value.length < 8) { setFieldError(f.pw.closest('.field'), 'Use at least 8 characters'); bad = true; }
    else if (f.pw.value !== f.pw2.value) { setFieldError(f.pw2.closest('.field'), 'Passwords don\'t match'); bad = true; }
    if (bad) return;
    const b = $('button[type=submit]', f); b.disabled = true; b.textContent = 'Setting up…';
    try { await store.completeInvite(f.email.value, f.pw.value); toast('You\'re all set'); location.hash = '#/chef'; routeChef(); }
    catch (err) { b.disabled = false; b.textContent = 'Create my profile'; toast(err.message, { bad: true, ms: 7000 }); }
  };
}

async function viewDashboard(chef) {
  const posts = await store.listPosts(chef.id, { all: true });
  const full = posts.length >= MAX_POSTS_PER_CHEF;
  render(`<div class="wrap">${head('<button class="btn xs ghost" data-out>Sign out</button>')}
    <section class="glass card flex" style="gap:14px">
      ${chef.photoUrl ? photo(chef.photoUrl, { cls: 'avatar lg', small: true, eager: true }) : '<div class="avatar lg"></div>'}
      <div style="flex:1;min-width:0"><div class="eyebrow">Your profile</div><h1 class="h-title" style="font-size:1.5rem">${esc(chef.name)}</h1><a class="small linkish" href="#/c/${esc(chef.id)}">View public profile</a></div>
    </section>
    <div class="flex between" style="margin:22px 0 10px"><div class="label" style="margin:0">Gallery · ${posts.length}/${MAX_POSTS_PER_CHEF}</div>
      <label class="btn sm gold ${full ? 'is-disabled' : ''}" style="position:relative;overflow:hidden">＋ Add photo<input type="file" accept="image/*" id="add-post" style="position:absolute;inset:0;opacity:0;cursor:pointer" ${full ? 'disabled' : ''}></label></div>
    ${full ? `<p class="small muted" style="margin:-4px 0 10px">You've reached ${MAX_POSTS_PER_CHEF} posts. Delete one to add a new photo.</p>` : ''}
    ${posts.length ? `<div class="gallery">${posts.map((p) => `<div class="tile ${p.hidden ? 'hidden-post' : ''}"><img class="ph" src="${esc(imgMeta(p.thumbUrl || p.imageUrl).src)}" alt="" loading="lazy" decoding="async" data-view="${esc(p.id)}" style="cursor:zoom-in">
        ${p.hidden ? '<span class="badge bad tile-badge">Hidden by Heebee</span>' : ''}
        <div class="tile-actions"><button class="btn xs glassy" data-edit="${esc(p.id)}" aria-label="Edit caption">✎</button><button class="btn xs glassy" data-del="${esc(p.id)}" aria-label="Delete">✕</button></div></div>`).join('')}</div>`
      : '<section class="glass card empty"><div class="sym">✦</div><p>Share photos of yourself and your dishes.</p><p class="muted small">They appear on your public profile like an Instagram grid.</p></section>'}
    <div class="label" style="margin-top:26px">Profile details</div>
    <div id="pf"></div>
  </div>`);
  wireOut();
  const refresh = async () => viewDashboard(await store.getChef(chef.id));
  $$('[data-view]').forEach((im) => (im.onclick = () => { const p = posts.find((x) => x.id === im.dataset.view); lightbox(p.imageUrl, p.caption, p.thumbUrl); }));
  $$('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!(await confirmBox('Delete this photo?', 'It will be removed from your gallery.', { ok: 'Delete', danger: true }))) return;
    await store.deletePost(chef.id, posts.find((p) => p.id === b.dataset.del)); toast('Photo deleted'); refresh();
  }));
  $$('[data-edit]').forEach((b) => (b.onclick = () => {
    const p = posts.find((x) => x.id === b.dataset.edit);
    const s = openSheet(`<h2 style="font-weight:300;margin:4px 0 12px">Edit caption</h2><div class="field"><textarea id="cap" rows="3" maxlength="300">${esc(p.caption)}</textarea></div><div class="row2"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="save-cap">Save</button></div>`, { center: true });
    $('#save-cap', s.el).onclick = async () => { await store.updatePost(chef.id, p.id, { caption: $('#cap', s.el).value.trim() }); s.close(); refresh(); };
  }));
  $('#add-post').onchange = async (e) => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    let blob, thumb;
    try {
      blob = await resizeImage(file, isDemo ? { maxDim: 1000, quality: 0.75 } : { maxDim: 1800 });
      thumb = await resizeImage(blob, { maxDim: 480, quality: 0.78 });
      thumb.preview = await previewOf(thumb);
    } catch (err) { return toast(err.message, { bad: true }); }
    const preview = URL.createObjectURL(blob);
    const s = openSheet(`<div class="sheet-head"><h2>New post</h2><button class="icon-btn glass" data-close aria-label="Close">✕</button></div>
      <img src="${preview}" alt="" style="width:100%;max-height:50vh;object-fit:cover;border-radius:18px;margin-bottom:14px">
      <div class="field"><label>Caption</label><textarea id="cap" rows="3" maxlength="300" placeholder="Tagliatelle al ragù, the Sunday way."></textarea></div>
      <p class="tiny muted">Optimised to ${blob.size < 1048576 ? Math.max(1, Math.round(blob.size / 1024)) + ' KB' : (blob.size / 1048576).toFixed(1) + ' MB'}</p>
      <button class="btn gold block" id="post">Post</button>`);
    $('#post', s.el).onclick = async () => {
      const b = $('#post', s.el); b.disabled = true; b.textContent = 'Posting…';
      try { await store.addPost(chef.id, blob, $('#cap', s.el).value.trim(), thumb); s.close(); toast('Posted'); refresh(); }
      catch (err) { b.disabled = false; b.textContent = 'Post'; toast(err.message, { bad: true }); }
    };
  };
  profileForm($('#pf'), chef, async (patch) => { await store.saveChef({ id: chef.id, ...patch }); toast('Profile saved'); refresh(); });
}

// Shared by the chef portal and the admin chef page.
export function profileForm(container, chef, onSave) {
  let photoUrl = chef.photoUrl || '', coverUrl = chef.coverUrl || '';
  let exp = (chef.experience || []).map((x) => ({ ...x }));
  const box = (url, label, h) => `<div class="upload-drop ${url ? 'has' : ''}" style="min-height:${h}px">${url ? photo(url, { eager: true }) : ''}<span class="over">${url ? 'Change' : '＋ ' + label}</span><input type="file" accept="image/*"></div>`;
  container.innerHTML = `<form class="glass card" novalidate>
    <div class="row2">
      <div class="field"><label>Profile photo</label><div data-up="photo">${box(photoUrl, 'Portrait', 170)}</div><div class="hint">Also used as the big photo on your profile.</div></div>
      <div class="field"><label>Cover photo (optional)</label><div data-up="cover">${box(coverUrl, 'Cover', 170)}</div><div class="hint">Replaces the portrait at the top.</div></div>
    </div>
    <div class="field"><label>Name <span class="req">*</span></label><input type="text" name="name" value="${esc(chef.name)}"><div class="err-msg"></div></div>
    <div class="field"><label>Title</label><input type="text" name="title" value="${esc(chef.title || '')}" placeholder="Italian cuisine · Fresh pasta"></div>
    <div class="field"><label>Bio</label><textarea name="bio" rows="6" placeholder="Your story, training and what you love to cook">${esc(chef.bio || '')}</textarea></div>
    <div class="field"><label>Experience</label><div id="exp"></div><button type="button" class="btn xs ghost" id="add-exp">＋ Add experience</button></div>
    <div class="field"><label>Achievements (one per line)</label><textarea name="achievements" rows="4" placeholder="Alma School of Italian Cuisine&#10;500+ students taught">${esc((chef.achievements || []).join('\n'))}</textarea></div>
    <div class="field"><label>Instagram link</label><input type="url" name="instagram" value="${esc(chef.instagram || '')}" placeholder="https://instagram.com/yourname"></div>
    <button class="btn gold block" type="submit">Save profile</button></form>`;
  const f = $('form', container);
  const paintExp = () => {
    $('#exp', f).innerHTML = exp.map((x, i) => `<div class="row3" data-i="${i}" style="margin-bottom:8px;grid-template-columns:1.2fr 1.4fr 1fr auto">
      <input class="input" data-k="role" value="${esc(x.role)}" placeholder="Head Chef"><input class="input" data-k="place" value="${esc(x.place)}" placeholder="Restaurant, city"><input class="input" data-k="years" value="${esc(x.years)}" placeholder="2016 – 2021"><button type="button" class="icon-btn" data-rm aria-label="Remove">✕</button></div>`).join('');
    $$('[data-i]', f).forEach((row) => {
      const x = exp[+row.dataset.i];
      $$('[data-k]', row).forEach((inp) => (inp.oninput = () => (x[inp.dataset.k] = inp.value)));
      $('[data-rm]', row).onclick = () => { exp.splice(+row.dataset.i, 1); paintExp(); };
    });
  };
  paintExp();
  $('#add-exp', f).onclick = () => { exp.push({ role: '', place: '', years: '' }); paintExp(); };
  $$('[data-up]', f).forEach((wrap) => {
    const el = $('.upload-drop', wrap), input = $('input', el);
    input.onchange = async () => {
      const file = input.files[0]; input.value = ''; if (!file) return;
      const over = $('.over', el); over.textContent = 'Uploading…';
      try {
        const blob = await resizeImage(file, isDemo ? { maxDim: 900, quality: 0.75 } : { maxDim: 1600 });
        const [small, t] = await Promise.all([resizeImage(blob, { maxDim: 360, quality: 0.8 }), previewOf(blob)]);
        const [full, s] = await Promise.all([store.uploadChef(chef.id, blob), store.uploadChef(chef.id, small)]);
        const url = packImg(full, { t, s });
        let im = $('img', el); if (!im) { im = document.createElement('img'); el.prepend(im); }
        im.src = imgMeta(url).src; el.classList.add('has'); over.textContent = 'Change';
        if (wrap.dataset.up === 'photo') photoUrl = url; else coverUrl = url;
      } catch (err) { over.textContent = 'Try again'; toast(err.message, { bad: true }); }
    };
  });
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (!f.name.value.trim()) return setFieldError(f.name.closest('.field'), 'Enter a name');
    const b = $('button[type=submit]', f); b.disabled = true;
    try {
      await onSave({
        name: f.name.value.trim(), title: f.title.value.trim(), bio: f.bio.value.trim(), photoUrl, coverUrl,
        experience: exp.filter((x) => x.role || x.place).map((x) => ({ role: x.role.trim(), place: x.place.trim(), years: x.years.trim() })),
        achievements: f.achievements.value.split('\n').map((s) => s.trim()).filter(Boolean), instagram: f.instagram.value.trim(),
      });
    } catch (err) { toast(err.message, { bad: true }); }
    b.disabled = false;
  };
}
