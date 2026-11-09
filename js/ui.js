// ابزارهای مشترک رابط کاربری: toast با «برگردان»، دیالوگ‌ها
const toast = document.getElementById('toast');
const msg = document.getElementById('toast-msg');
const undoBtn = document.getElementById('toast-undo');
let timer = 0, undoFn = null;

export function showToast(text, undo) {
  clearTimeout(timer);
  msg.textContent = text;
  undoFn = undo || null;
  undoBtn.hidden = !undo;
  toast.hidden = false;
  toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
  timer = setTimeout(hideToast, 6000);
}

export function hideToast() {
  toast.classList.remove('show');
  toast.hidden = true;
  undoFn = null;
}

undoBtn.addEventListener('click', () => {
  const fn = undoFn;
  hideToast();
  if (fn) fn();
});

// دیالوگ بومی: تله‌ی فوکوس و Esc را خودش دارد. کلیک روی پس‌زمینه هم می‌بندد.
export function wireDialog(dlg) {
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
    if (e.target.closest('[data-close]')) dlg.close();
  });
}

export const fa = (n, opts) => Number(n).toLocaleString('fa-IR', opts);

export const faStr = (s) => String(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
