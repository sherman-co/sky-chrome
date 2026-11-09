// نشانک‌های دسته‌بندی‌شده: افزودن، حذف (با برگردان)، جمع/باز کردن دسته
import { get, set, uid } from './store.js';
import { showToast, wireDialog, fa } from './ui.js';

const list = document.getElementById('bm-list');
const addBtn = document.getElementById('bm-add-btn');
const editBtn = document.getElementById('bm-edit-btn');
const dlg = document.getElementById('bm-dialog');
const form = document.getElementById('bm-form');
const urlIn = document.getElementById('bm-url');
const nameIn = document.getElementById('bm-name');
const catIn = document.getElementById('bm-cat');
const chipsEl = document.getElementById('bm-cat-chips');
const errEl = document.getElementById('bm-error');

const DEFAULTS = () => [
  { id: uid(), name: 'برنامه‌نویسی', collapsed: false, items: [
    { id: uid(), name: 'گیت‌هاب', url: 'https://github.com' },
    { id: uid(), name: 'دی اسپیچ', url: 'https://dey-speech.ir' },
  ] },
];

let cats = [];
let editing = false;
let lastCat = '';
let justAdded = null;

export function initBookmarks() {
  cats = get('bookmarks', null) || DEFAULTS();
  if (!get('bookmarks', null)) save();
  lastCat = cats[0]?.name || 'عمومی';
  render();

  wireDialog(dlg);
  addBtn.addEventListener('click', () => openDialog());
  editBtn.addEventListener('click', () => {
    editing = !editing;
    editBtn.setAttribute('aria-pressed', String(editing));
    document.body.classList.toggle('editing', editing);
    render();
  });

  list.addEventListener('click', onClick);
  // فاوآیکون خراب → حرف اول
  list.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG') {
      const f = e.target.closest('.fav');
      f.textContent = f.dataset.letter;
    }
  }, true);

  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  chipsEl.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cat]');
    if (b) { catIn.value = b.dataset.cat; catIn.focus(); markChip(); }
  });
  catIn.addEventListener('input', markChip);
}

function save() { set('bookmarks', cats); }

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function host(url) { try { return new URL(url).hostname; } catch { return ''; } }

function render() {
  if (!cats.length) {
    list.innerHTML = `<div class="empty small"><p>هنوز نشانکی نداری.</p><button type="button" class="btn" data-act="add">+ افزودن اولین نشانک</button></div>`;
    return;
  }
  list.innerHTML = cats.map((c) => {
    const open = !c.collapsed;
    return `<section class="cat" data-cat="${c.id}">
      <div class="cat-head">
        <button type="button" class="cat-toggle" data-act="toggle" aria-expanded="${open}" aria-controls="g-${c.id}">
          <svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
          <span class="cat-name">${esc(c.name)}</span>
          <span class="count" aria-label="${fa(c.items.length)} نشانک">${fa(c.items.length)}</span>
        </button>
        <span class="cat-tools">
          <button type="button" class="mini" data-act="add-in" aria-label="افزودن نشانک به دستهٔ ${esc(c.name)}" title="افزودن به این دسته">+</button>
          <button type="button" class="mini danger edit-only" data-act="del-cat" aria-label="حذف دستهٔ ${esc(c.name)}" title="حذف دسته">حذف دسته</button>
        </span>
      </div>
      <div class="collapse ${open ? 'open' : ''}" id="g-${c.id}">
        <div class="collapse-inner">
          <ul class="grid">${c.items.map((b) => card(b)).join('')}</ul>
        </div>
      </div>
    </section>`;
  }).join('');
  justAdded = null;
}

function card(b) {
  const h = host(b.url);
  const letter = esc((b.name || h || '?').trim().charAt(0).toUpperCase());
  const src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=64`;
  return `<li class="bm glass ${justAdded === b.id ? 'enter' : ''}" data-id="${b.id}">
    <a class="bm-link" href="${esc(b.url)}">
      <span class="fav" data-letter="${letter}"><img src="${src}" alt="" width="28" height="28" loading="lazy"></span>
      <span class="bm-name" dir="auto">${esc(b.name)}</span>
    </a>
    <button type="button" class="bm-del" data-act="del-bm" aria-label="حذف نشانک ${esc(b.name)}" title="حذف">✕</button>
  </li>`;
}

function onClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  const sec = btn.closest('.cat');
  const cat = sec && cats.find((c) => c.id === sec.dataset.cat);

  if (act === 'add') openDialog();
  else if (act === 'add-in' && cat) openDialog(cat.name);
  else if (act === 'toggle' && cat) {
    cat.collapsed = !cat.collapsed; save();
    // انیمیشن بدون رندر مجدد
    const open = !cat.collapsed;
    btn.setAttribute('aria-expanded', String(open));
    sec.querySelector('.collapse').classList.toggle('open', open);
  } else if (act === 'del-bm' && cat) {
    const li = btn.closest('.bm');
    const idx = cat.items.findIndex((b) => b.id === li.dataset.id);
    const [item] = cat.items.splice(idx, 1);
    const catIdx = cats.indexOf(cat);
    let removedCat = false;
    if (!cat.items.length && !editing) { cats.splice(catIdx, 1); removedCat = true; }
    save();
    li.classList.add('leaving');
    setTimeout(render, 160);
    showToast(`«${item.name}» حذف شد`, () => {
      if (removedCat) { cat.items = [item]; cats.splice(catIdx, 0, cat); }
      else cat.items.splice(idx, 0, item);
      save(); render();
    });
  } else if (act === 'del-cat' && cat) {
    const idx = cats.indexOf(cat);
    cats.splice(idx, 1); save(); render();
    showToast(`دستهٔ «${cat.name}» حذف شد`, () => { cats.splice(idx, 0, cat); save(); render(); });
  }
}

function openDialog(prefCat) {
  form.reset();
  errEl.textContent = '';
  catIn.value = prefCat || lastCat;
  chipsEl.innerHTML = cats.map((c) => `<button type="button" class="chip-btn" data-cat="${esc(c.name)}" aria-pressed="false">${esc(c.name)}</button>`).join('');
  markChip();
  dlg.showModal();
  urlIn.focus();
}

function markChip() {
  const v = catIn.value.trim();
  chipsEl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === v)));
}

function submit() {
  let url = urlIn.value.trim();
  const category = catIn.value.trim();
  errEl.textContent = '';
  if (!url) { errEl.textContent = 'آدرس سایت را وارد کن.'; urlIn.focus(); return; }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = 'https://' + url;
  let u;
  try { u = new URL(url); if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) throw 0; }
  catch { errEl.textContent = 'این آدرس معتبر به نظر نمی‌رسد (مثلاً example.com).'; urlIn.focus(); return; }
  if (!category) { errEl.textContent = 'یک دسته‌بندی انتخاب کن یا بنویس.'; catIn.focus(); return; }

  const name = nameIn.value.trim() || u.hostname.replace(/^www\./, '');
  let cat = cats.find((c) => c.name.toLowerCase() === category.toLowerCase());
  if (!cat) { cat = { id: uid(), name: category, collapsed: false, items: [] }; cats.push(cat); }
  cat.collapsed = false;
  const item = { id: uid(), name, url: u.href };
  cat.items.push(item);
  lastCat = cat.name;
  justAdded = item.id;
  save(); render();
  dlg.close();
}
