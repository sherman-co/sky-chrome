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
let active = 'all';

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
  if (active !== 'all' && !cats.some((c) => c.id === active)) active = 'all';
  const total = cats.reduce((n, c) => n + c.items.length, 0);
  const tab = (id, name, n) => `<button type="button" class="tab" data-act="tab" data-id="${id}" aria-pressed="${active === id}">${esc(name)}<span class="count">${fa(n)}</span></button>`;
  const shown = active === 'all' ? cats : cats.filter((c) => c.id === active);
  const items = shown.flatMap((c) => c.items.map((bm) => card(bm, c)));
  list.innerHTML = `
    <div class="tabs" role="group" aria-label="دسته‌بندی نشانک‌ها">
      ${tab('all', 'همه', total)}
      ${cats.map((c) => tab(c.id, c.name, c.items.length)).join('')}
      ${editing && active !== 'all' ? `<button type="button" class="tab danger" data-act="del-cat" data-id="${active}">حذف این دسته</button>` : ''}
    </div>
    <ul class="grid" id="bm-grid">
      ${items.join('')}
      <li class="bm-add"><button type="button" data-act="add-in" aria-label="افزودن نشانک جدید"><span aria-hidden="true">+</span>افزودن</button></li>
    </ul>`;
  justAdded = null;
}

function card(b, c) {
  const h = host(b.url);
  const letter = esc((b.name || h || '?').trim().charAt(0).toUpperCase());
  const src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=128`;
  return `<li class="bm glass ${justAdded === b.id ? 'enter' : ''}" data-id="${b.id}" data-cat="${c.id}">
    <a class="bm-link" href="${esc(b.url)}">
      <span class="fav" data-letter="${letter}"><img src="${src}" alt="" width="34" height="34" loading="lazy"></span>
      <span class="bm-name" dir="auto">${esc(b.name)}</span>
    </a>
    <button type="button" class="bm-del" data-act="del-bm" aria-label="حذف نشانک ${esc(b.name)}" title="حذف">✕</button>
  </li>`;
}

function onClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;

  if (act === 'add') openDialog();
  else if (act === 'add-in') openDialog(active === 'all' ? undefined : cats.find((c) => c.id === active)?.name);
  else if (act === 'tab') { active = btn.dataset.id; render(); document.querySelector(`.tab[data-id="${active}"]`)?.focus(); }
  else if (act === 'del-bm') {
    const li = btn.closest('.bm');
    const cat = cats.find((c) => c.id === li.dataset.cat);
    if (!cat) return;
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
  } else if (act === 'del-cat') {
    const cat = cats.find((c) => c.id === btn.dataset.id);
    if (!cat) return;
    const idx = cats.indexOf(cat);
    cats.splice(idx, 1); active = 'all'; save(); render();
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
  if (active !== 'all') active = cat.id;
  justAdded = item.id;
  save(); render();
  dlg.close();
}
