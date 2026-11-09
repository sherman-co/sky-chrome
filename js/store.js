// ذخیره‌سازی: chrome.storage.local در افزونه، و localStorage هنگام تست در مرورگر معمولی
const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
const cache = {};

const KEYS = ['bookmarks', 'notes', 'location', 'settings', 'weatherCache'];

export const DEFAULT_SETTINGS = {
  unit: 'c',          // c | f
  size: 'm',          // s | m | l
  fx: true,           // افکت‌های پس‌زمینه
  contrast: false,    // کنتراست بالا
  simKind: 'auto',    // پیش‌نمایش وضعیت جوی
  simHour: -1,        // پیش‌نمایش ساعت (-1 = واقعی)
};

export const DEFAULT_LOCATION = { lat: 36.2605, lon: 59.6168, name: 'مشهد' };

export async function initStore() {
  if (hasChrome) {
    Object.assign(cache, await chrome.storage.local.get(KEYS));
  } else {
    for (const k of KEYS) {
      try {
        const v = localStorage.getItem('sky.' + k);
        if (v != null) cache[k] = JSON.parse(v);
      } catch { /* ignore */ }
    }
  }
  migrateLegacy();
}

export function get(key, fallback) {
  return cache[key] !== undefined ? cache[key] : fallback;
}

export function set(key, value) {
  cache[key] = value;
  if (hasChrome) chrome.storage.local.set({ [key]: value });
  else {
    try { localStorage.setItem('sky.' + key, JSON.stringify(value)); } catch { /* ignore */ }
  }
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// داده‌های نسخهٔ قبلی (localStorage) را یک‌بار به ساختار جدید منتقل می‌کند
function migrateLegacy() {
  try {
    if (cache.bookmarks === undefined) {
      const raw = localStorage.getItem('skyBookmarksGrouped');
      if (raw) {
        const old = JSON.parse(raw);
        const cats = Object.entries(old).map(([name, items]) => ({
          id: uid(), name, collapsed: false,
          items: items.map(b => ({ id: uid(), name: b.name, url: b.url })),
        }));
        if (cats.length) set('bookmarks', cats);
      }
    }
    if (cache.location === undefined) {
      const raw = localStorage.getItem('skyLocation');
      if (raw) {
        const l = JSON.parse(raw);
        if (l && typeof l.lat === 'number') set('location', l);
      }
    }
  } catch { /* ignore */ }
}
