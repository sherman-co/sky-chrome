// دفترچه یادداشت چت‌مانند: هر Enter یک پیام می‌شود؛ با ایموجی ✅ می‌شود «انجام شد» زد
import { get, set, uid } from './store.js';
import { showToast, fa } from './ui.js';

const DONE = '✅';
const PICKER = ['✅', '👍', '⭐', '🔥', '⏳', '💡', '❤️'];

const log = document.getElementById('notes-log');
const form = document.getElementById('composer');
const input = document.getElementById('note-input');
const sub = document.getElementById('notes-sub');
const filterBtn = document.getElementById('notes-filter');
const clearBtn = document.getElementById('notes-clear');

let notes = [];
let onlyOpen = false;
let openPicker = null;   // id یادداشتی که پیکر باز دارد

export function initNotes() {
  notes = get('notes', []);
  render(true);

  form.addEventListener('submit', (e) => { e.preventDefault(); send(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  input.addEventListener('input', autosize);

  filterBtn.addEventListener('click', () => {
    onlyOpen = !onlyOpen;
    filterBtn.setAttribute('aria-pressed', String(onlyOpen));
    render(true);
  });
  clearBtn.addEventListener('click', clearDone);

  log.addEventListener('click', onLogClick);
  document.addEventListener('click', (e) => {
    if (openPicker && !e.target.closest('.picker, [data-act="react"]')) { openPicker = null; render(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openPicker) { openPicker = null; render(); }
    if ((e.key === 'n' || e.key === 'N' || e.key === 'ی') && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.querySelector('dialog[open]')) {
      e.preventDefault(); input.focus();
    }
  });
}

function save() { set('notes', notes); }

function autosize() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 130) + 'px';
}

function send() {
  const text = input.value.trim();
  if (!text) return;
  notes.push({ id: uid(), text, t: Date.now(), reactions: [] });
  save();
  input.value = ''; autosize();
  if (onlyOpen) { onlyOpen = false; filterBtn.setAttribute('aria-pressed', 'false'); }
  render(true, true);
}

const isDone = (n) => n.reactions.includes(DONE);

function clearDone() {
  const done = notes.filter(isDone);
  if (!done.length) { showToast('کار انجام‌شده‌ای برای پاک کردن نیست'); return; }
  const prev = notes.slice();
  notes = notes.filter((n) => !isDone(n));
  save(); render(true);
  showToast(`${fa(done.length)} یادداشت انجام‌شده پاک شد`, () => { notes = prev; save(); render(true); });
}

function onLogClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const li = btn.closest('[data-id]');
  const id = li.dataset.id;
  const n = notes.find((x) => x.id === id);
  if (!n) return;
  const act = btn.dataset.act;

  if (act === 'done') toggleReaction(n, DONE);
  else if (act === 'react') { openPicker = openPicker === id ? null : id; render(); focusAfter(id, '[data-act="react"]'); }
  else if (act === 'emoji') { toggleReaction(n, btn.dataset.e); openPicker = null; render(); focusAfter(id, '[data-act="react"]'); }
  else if (act === 'chip') toggleReaction(n, btn.dataset.e);
  else if (act === 'del') {
    const idx = notes.indexOf(n);
    notes.splice(idx, 1); save(); render();
    showToast('یادداشت حذف شد', () => { notes.splice(idx, 0, n); save(); render(true); });
  }
}

function focusAfter(id, sel) {
  const el = log.querySelector(`[data-id="${id}"] ${sel}`);
  if (el) el.focus();
}

function toggleReaction(n, emoji) {
  const i = n.reactions.indexOf(emoji);
  if (i >= 0) n.reactions.splice(i, 1); else n.reactions.push(emoji);
  save();
  const justDone = emoji === DONE && i < 0;
  render();
  focusAfter(n.id, emoji === DONE ? '[data-act="done"]' : `[data-act="chip"][data-e="${emoji}"]`);
  if (justDone) {
    const el = log.querySelector(`[data-id="${n.id}"]`);
    if (el) el.classList.add('pop');
  }
}

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function timeLabel(t) {
  const d = new Date(t), now = new Date();
  const hm = d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return hm;
  return d.toLocaleDateString('fa-IR', { day: 'numeric', month: 'short' }) + ' ' + hm;
}

function render(reset = false, scrollEnd = false) {
  const keep = log.scrollTop, atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  const list = onlyOpen ? notes.filter((n) => !isDone(n)) : notes;
  const open = notes.filter((n) => !isDone(n)).length;
  sub.textContent = notes.length ? `${fa(open)} باز · ${fa(notes.length - open)} انجام‌شده` : 'خالی';
  clearBtn.disabled = !notes.some(isDone);

  if (!list.length) {
    log.innerHTML = `<div class="empty"><span aria-hidden="true">📝</span><p>${onlyOpen ? 'همه‌چیز انجام شده 🎉' : 'هر چیزی که به ذهنت می‌رسد بنویس و Enter بزن.<br>با ✅ مشخص کن که انجامش دادی.'}</p></div>`;
    return;
  }

  log.innerHTML = list.map((n) => {
    const done = isDone(n);
    const chips = n.reactions.filter((r) => r !== DONE)
      .map((r) => `<button type="button" class="chip-react" data-act="chip" data-e="${r}" aria-label="برداشتن ${r}">${r}</button>`).join('');
    const picker = openPicker === n.id
      ? `<div class="picker" role="menu" aria-label="انتخاب ایموجی">${PICKER.map((e) => `<button type="button" role="menuitem" data-act="emoji" data-e="${e}" aria-label="${e}">${e}</button>`).join('')}</div>` : '';
    return `<article class="msg ${done ? 'done' : ''}" data-id="${n.id}">
      <div class="bubble">
        <p class="text" dir="auto">${esc(n.text).replace(/\n/g, '<br>')}</p>
        ${chips ? `<div class="reacts">${chips}</div>` : ''}
        <div class="meta">
          <time>${timeLabel(n.t)}</time>
          <span class="acts">
            <button type="button" class="act ${done ? 'on' : ''}" data-act="done" aria-pressed="${done}" aria-label="${done ? 'برگرداندن به کارهای باز' : 'انجام شد'}" title="${done ? 'برگردان' : 'انجام دادم'}">${DONE}</button>
            <button type="button" class="act" data-act="react" aria-haspopup="menu" aria-expanded="${openPicker === n.id}" aria-label="افزودن ایموجی" title="ایموجی">☺</button>
            <button type="button" class="act del" data-act="del" aria-label="حذف یادداشت" title="حذف">✕</button>
          </span>
        </div>
        ${picker}
      </div>
    </article>`;
  }).join('');

  if (scrollEnd || (reset && !keep) || (reset && atEnd)) log.scrollTop = log.scrollHeight;
  else log.scrollTop = keep;
}
