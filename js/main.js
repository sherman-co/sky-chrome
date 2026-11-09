import { initStore, get, set, DEFAULT_SETTINGS, DEFAULT_LOCATION } from './store.js';
import { fetchWeather, applySim, searchCity, kindOf, textOf, icon, windDirText, toF, localMinutes } from './weather.js';
import { setSky, tickSky } from './sky.js';
import { initNotes } from './notes.js';
import { initBookmarks } from './bookmarks.js';
import { wireDialog, fa, faStr } from './ui.js';

const $ = (id) => document.getElementById(id);
const STALE_MS = 10 * 60 * 1000;

let settings = { ...DEFAULT_SETTINGS };
let loc = DEFAULT_LOCATION;
let real = null;          // آخرین داده‌ی واقعی
let loadError = false;

await initStore();
settings = { ...DEFAULT_SETTINGS, ...get('settings', {}) };
loc = get('location', DEFAULT_LOCATION);
real = get('weatherCache', null);
if (real && real.loc && (Math.abs(real.loc.lat - loc.lat) > 0.01 || Math.abs(real.loc.lon - loc.lon) > 0.01)) real = null;

/* ------------------------------ ساعت ------------------------------ */
function startClock() {
  const timeEl = $('time'), dateEl = $('date'), greet = $('greeting');
  let lastMin = -1;
  const tick = () => {
    const now = new Date();
    const m = now.getMinutes();
    if (m === lastMin) return;
    lastMin = m;
    timeEl.textContent = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false });
    dateEl.textContent = now.toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const h = now.getHours();
    greet.textContent = h >= 5 && h < 11 ? 'صبح بخیر' : h < 15 && h >= 11 ? 'ظهر بخیر' : h >= 15 && h < 18 ? 'عصر بخیر' : h >= 18 && h < 23 ? 'شب بخیر' : 'نیمه‌شب بخیر';
    document.title = timeEl.textContent;
  };
  tick();
  setInterval(tick, 1000);
}

/* ------------------------------ آب‌وهوا ------------------------------ */
async function refreshWeather() {
  try {
    const w = await fetchWeather(loc);
    w.loc = { lat: loc.lat, lon: loc.lon };
    real = w; loadError = false;
    set('weatherCache', w);
  } catch {
    loadError = true;
  }
  renderWeather();
  pushSky();
}

const shown = () => (real ? applySim(real, settings.simKind) : null);

function isDayNow(w) {
  const t = settings.simHour >= 0 ? settings.simHour * 60 + 30 : localMinutes(w.offset);
  return t >= w.sunrise && t <= w.sunset;
}

const T = (c) => `\u2066${fa(Math.round(settings.unit === 'f' ? toF(c) : c))}°\u2069`;

function renderWeather() {
  const w = shown();
  $('chip-city').textContent = loc.name;
  const chipIcon = $('chip-icon'), chipTemp = $('chip-temp'), chipDesc = $('chip-desc');

  if (!w) {
    chipIcon.innerHTML = ''; chipTemp.textContent = '--°';
    chipDesc.textContent = loadError ? 'بدون اتصال' : 'در حال دریافت…';
    $('weather-body').innerHTML = `<p class="hint">${loadError ? 'دریافت آب‌وهوا ممکن نشد. اتصال اینترنت را بررسی کن.' : 'در حال دریافت اطلاعات…'}</p>
      <button type="button" class="btn" id="wp-retry">تلاش دوباره</button>`;
    $('wp-retry')?.addEventListener('click', refreshWeather);
    return;
  }

  const n = w.now;
  const day = isDayNow(w);
  const kind = kindOf(n.code);
  chipIcon.innerHTML = icon(kind, day);
  chipTemp.textContent = T(n.temp);
  chipDesc.textContent = textOf(n.code) + (loadError ? ' (قدیمی)' : '');

  const today = w.daily[0];
  const stats = [
    ['💧', 'رطوبت', `${fa(n.humidity)}٪`],
    ['🌬️', 'باد', `${fa(Math.round(n.wind))} km/h · ${windDirText(n.windDir)}`],
    ['☔', 'احتمال بارش', today.pop != null ? `${fa(today.pop)}٪` : '—'],
    ['☁️', 'پوشش ابر', `${fa(n.cloud)}٪`],
    ['🌅', 'طلوع', w.sunriseStr ? faStr(w.sunriseStr) : '—'],
    ['🌇', 'غروب', w.sunsetStr ? faStr(w.sunsetStr) : '—'],
  ];
  const dayName = (iso, i) => (i === 0 ? 'امروز' : i === 1 ? 'فردا' : new Date(iso + 'T12:00').toLocaleDateString('fa-IR', { weekday: 'long' }));
  const hrIsDay = (h) => h * 60 >= w.sunrise && h * 60 <= w.sunset;
  const ago = Math.max(0, Math.round((Date.now() - w.fetchedAt) / 60000));

  $('weather-body').innerHTML = `
    <div class="wp-top">
      <div class="wp-icon">${icon(kind, day)}</div>
      <div class="wp-main">
        <div class="wp-temp">${T(n.temp)}</div>
        <div class="wp-desc">${textOf(n.code)}</div>
        <div class="wp-feels">احساس‌شده ${T(n.feels)} · امروز ${T(today.min)} تا ${T(today.max)}</div>
      </div>
      <div class="wp-btns">
        <button type="button" class="icon-btn sm plain" id="wp-refresh" aria-label="به‌روزرسانی آب‌وهوا" title="به‌روزرسانی">↻</button>
        <button type="button" class="icon-btn sm plain" id="wp-city" aria-label="تغییر شهر" title="تغییر شهر">📍</button>
      </div>
    </div>
    <ul class="stats">${stats.map(([i, l, v]) => `<li><span class="si" aria-hidden="true">${i}</span><span class="sl">${l}</span><span class="sv">${v}</span></li>`).join('')}</ul>
    <h3 class="wp-h">ساعت‌های آینده</h3>
    <ol class="hourly">${w.hourly.map((h, i) => `<li><span class="hh">${i === 0 ? 'الان' : fa(h.hour) + ':۰۰'}</span><span class="hi">${icon(kindOf(h.code), hrIsDay(h.hour))}</span><span class="ht">${T(h.temp)}</span>${h.pop > 10 ? `<span class="hp">${fa(h.pop)}٪</span>` : '<span class="hp"></span>'}</li>`).join('')}</ol>
    <h3 class="wp-h">روزهای آینده</h3>
    <ul class="daily">${w.daily.map((d, i) => `<li><span class="dn">${dayName(d.date, i)}</span><span class="di">${icon(kindOf(d.code), true)}</span><span class="dt">${textOf(d.code)}</span><span class="dr"><b>${T(d.max)}</b> <i>${T(d.min)}</i></span></li>`).join('')}</ul>
    <p class="updated">${loadError ? 'اتصال برقرار نشد؛ آخرین داده نمایش داده می‌شود · ' : ''}به‌روزرسانی: ${ago ? fa(ago) + ' دقیقه پیش' : 'هم‌اکنون'}</p>`;

  $('wp-refresh').addEventListener('click', async (e) => {
    e.currentTarget.classList.add('spin');
    await refreshWeather();
  });
  $('wp-city').addEventListener('click', () => openSettings('#city-input'));
}

// چیپ آب‌وهوا ⇢ باز/بسته کردن پنل
const chip = $('weather-chip');
const panel = $('weather-panel');
chip.addEventListener('click', () => toggleWeather());
function toggleWeather(force) {
  const open = force ?? chip.getAttribute('aria-expanded') !== 'true';
  chip.setAttribute('aria-expanded', String(open));
  panel.classList.toggle('open', open);
  if (open && real && Date.now() - real.fetchedAt > STALE_MS) refreshWeather();
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && panel.classList.contains('open') && !document.querySelector('dialog[open]')) {
    toggleWeather(false); chip.focus();
  }
});

/* ------------------------------ آسمان ------------------------------ */
function pushSky() {
  const w = shown();
  const base = real || { offset: undefined, sunrise: 360, sunset: 1080 };
  setSky({
    kind: w ? kindOf(w.now.code) : 'clear',
    code: w ? w.now.code : 0,
    cloud: w ? w.now.cloud : 10,
    offset: base.offset, sunrise: base.sunrise, sunset: base.sunset,
    hourOverride: settings.simHour,
    fxOn: settings.fx,
  });
}

/* ------------------------------ تنظیمات ------------------------------ */
function applySettings() {
  document.documentElement.dataset.size = settings.size;
  document.body.classList.toggle('hc', settings.contrast);
}
function saveSettings() { set('settings', settings); applySettings(); renderWeather(); pushSky(); }

const sDlg = $('settings-dialog');
wireDialog(sDlg);
$('settings-btn').addEventListener('click', () => openSettings());

function openSettings(focusSel) {
  syncSettingsUI();
  $('city-results').innerHTML = '';
  $('loc-status').textContent = `موقعیت فعلی: ${loc.name}`;
  $('city-input').value = '';
  sDlg.showModal();
  if (focusSel) $(focusSel.slice(1))?.focus();
}

function syncSettingsUI() {
  setSeg('seg-unit', settings.unit);
  setSeg('seg-size', settings.size);
  $('sw-fx').checked = settings.fx;
  $('sw-contrast').checked = settings.contrast;
  $('sim-kind').value = settings.simKind;
  $('sim-hour').value = settings.simHour;
  $('sim-hour-out').textContent = settings.simHour < 0 ? 'واقعی' : `${fa(settings.simHour)}:۰۰`;
}

function setSeg(id, v) {
  document.querySelectorAll(`#${id} button`).forEach((b) => {
    const on = b.dataset.v === v;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  });
}

for (const [id, key] of [['seg-unit', 'unit'], ['seg-size', 'size']]) {
  const seg = $(id);
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    settings[key] = b.dataset.v; setSeg(id, b.dataset.v); saveSettings();
  });
  seg.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const btns = [...seg.querySelectorAll('button')];
    const i = btns.findIndex((b) => b.getAttribute('aria-checked') === 'true');
    const dir = (e.key === 'ArrowLeft' || e.key === 'ArrowDown') ? 1 : -1; // RTL
    const nb = btns[(i + dir + btns.length) % btns.length];
    nb.click(); nb.focus(); e.preventDefault();
  });
}

$('sw-fx').addEventListener('change', (e) => { settings.fx = e.target.checked; saveSettings(); });
$('sw-contrast').addEventListener('change', (e) => { settings.contrast = e.target.checked; saveSettings(); });
$('sim-kind').addEventListener('change', (e) => { settings.simKind = e.target.value; saveSettings(); });
$('sim-hour').addEventListener('input', (e) => {
  settings.simHour = Number(e.target.value);
  $('sim-hour-out').textContent = settings.simHour < 0 ? 'واقعی' : `${fa(settings.simHour)}:۰۰`;
  saveSettings();
});

/* جستجوی شهر */
let cityTimer = 0, citySeq = 0;
$('city-input').addEventListener('input', (e) => {
  clearTimeout(cityTimer);
  const q = e.target.value.trim();
  const res = $('city-results');
  if (q.length < 2) { res.innerHTML = ''; return; }
  $('loc-status').textContent = 'در حال جستجو…';
  cityTimer = setTimeout(async () => {
    const my = ++citySeq;
    try {
      const items = await searchCity(q);
      if (my !== citySeq) return;
      $('loc-status').textContent = items.length ? 'یکی را انتخاب کن:' : 'شهری پیدا نشد.';
      res.innerHTML = items.map((r, i) => `<li><button type="button" role="option" data-i="${i}"><b>${r.name}</b><span>${r.sub}</span></button></li>`).join('');
      res._items = items;
    } catch { $('loc-status').textContent = 'خطا در ارتباط. دوباره تلاش کن.'; }
  }, 350);
});
$('city-results').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-i]');
  if (!b) return;
  chooseLocation($('city-results')._items[Number(b.dataset.i)]);
});
$('city-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('city-results').querySelector('button')?.click(); }
});

function chooseLocation(l) {
  loc = { lat: l.lat, lon: l.lon, name: l.name };
  set('location', loc);
  real = null; loadError = false;
  $('loc-status').textContent = `موقعیت: ${loc.name} ✓`;
  $('city-results').innerHTML = '';
  renderWeather(); pushSky();
  refreshWeather();
  setTimeout(() => sDlg.open && sDlg.close(), 700);
}

$('geo-btn').addEventListener('click', () => {
  const st = $('loc-status');
  if (!navigator.geolocation) { st.textContent = 'مرورگر از موقعیت‌یابی پشتیبانی نمی‌کند.'; return; }
  st.textContent = 'در حال تعیین موقعیت…';
  navigator.geolocation.getCurrentPosition(
    (p) => chooseLocation({ lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3), name: 'موقعیت من' }),
    () => { st.textContent = 'دسترسی به موقعیت داده نشد. می‌توانی نام شهر را جستجو کنی.'; },
    { timeout: 10000, maximumAge: 600000 },
  );
});

/* ------------------------------ میانبر جستجو ------------------------------ */
document.addEventListener('keydown', (e) => {
  if ((e.key === '/' || e.key === '÷') && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.querySelector('dialog[open]')) {
    e.preventDefault(); $('search-input').focus();
  }
});

/* ------------------------------ شروع ------------------------------ */
applySettings();
initNotes();
initBookmarks();
startClock();
renderWeather();
pushSky();
refreshWeather();

setInterval(() => { tickSky(); }, 30 * 1000);
setInterval(() => { if (!real || Date.now() - real.fetchedAt > STALE_MS) refreshWeather(); }, 60 * 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { tickSky(); if (!real || Date.now() - real.fetchedAt > STALE_MS) refreshWeather(); }
});

