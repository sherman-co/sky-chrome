// آسمان زنده: رنگ بر اساس ارتفاع واقعی خورشید + وضعیت جوی، خورشید/ماه، ابر، ستاره، باران، برف، رعد، مه
import { kindOf, localMinutes } from './weather.js';

const root = document.documentElement;
const $ = (id) => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

// ---------- ابزار رنگ ----------
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lerp = (a, b, t) => a + (b - a) * t;
const lerpC = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const css = (c) => `rgb(${c.map((v) => Math.round(v)).join(',')})`;
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// کلیدهای پالت: ارتفاع خورشید (e) ← [بالا، وسط، افق]
const KEYS = [
  [-1.0, '#04081a', '#080f2b', '#111c46'],
  [-0.30, '#0a1433', '#16255a', '#2f3a76'],
  [-0.08, '#1b2a63', '#5b4a8a', '#d9714f'],
  [0.05, '#2a4b8f', '#b2708a', '#f3a066'],
  [0.25, '#2a68b2', '#6a9ccf', '#e8b985'],
  [0.60, '#2263b2', '#4c97da', '#86bde6'],
  [1.0, '#1b5eae', '#4291d8', '#7fb8e4'],
].map(([e, a, b, c]) => ({ e, c: [hex(a), hex(b), hex(c)] }));

function paletteAt(e) {
  let i = 0;
  while (i < KEYS.length - 2 && e > KEYS[i + 1].e) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = clamp((e - a.e) / (b.e - a.e));
  return a.c.map((c, k) => lerpC(c, b.c[k], t));
}

// ارتفاع نسبی خورشید در بازهٔ [-1, 1] با استفاده از طلوع/غروب واقعی
export function elevation(t, sr, ss) {
  if (t >= sr && t <= ss) return Math.sin(Math.PI * (t - sr) / (ss - sr));
  const nightLen = 1440 - (ss - sr);
  const dt = t > ss ? t - ss : t + 1440 - ss;
  return -Math.sin(Math.PI * dt / nightLen);
}

// اثر وضعیت جوی روی رنگ: gray=چقدر به خاکستری برود، dark=ضریب تیرگی، lift=روشن‌شدن (مه/برف)
const WX = {
  clear: { gray: 0, dark: 1, lift: 0 },
  partly: { gray: 0.12, dark: 0.98, lift: 0 },
  cloudy: { gray: 0.5, dark: 0.9, lift: 0 },
  fog: { gray: 0.62, dark: 0.96, lift: 0.1 },
  drizzle: { gray: 0.55, dark: 0.86, lift: 0 },
  rain: { gray: 0.68, dark: 0.78, lift: 0 },
  snow: { gray: 0.45, dark: 0.97, lift: 0.1 },
  storm: { gray: 0.8, dark: 0.6, lift: 0 },
};

// ---------- وضعیت ----------
let cfg = null;      // آخرین ورودی
let cloudKey = '';
let fx = { mode: 'none', heavy: false, storm: false, stars: 0 };

export function setSky(input) {
  cfg = input;
  render();
  syncFx();
}

export function tickSky() {
  if (cfg) render(true);
}

function moonPhase(date = new Date()) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  return (((jd - 2451550.1) / 29.530588853) % 1 + 1) % 1;
}

function moonSvg() {
  const f = moonPhase();
  const R = 40, c = 50;
  const rx = Math.abs(Math.cos(2 * Math.PI * f)) * R;
  const waxing = f < 0.5;
  const sweep = waxing ? (f < 0.25 ? 0 : 1) : (f > 0.75 ? 1 : 0);
  const half = waxing ? 1 : 0;
  const d = `M${c} ${c - R} A${R} ${R} 0 0 ${half} ${c} ${c + R} A${rx.toFixed(2)} ${R} 0 0 ${sweep} ${c} ${c - R}Z`;
  return `<svg viewBox="0 0 100 100" width="100%" height="100%">
    <defs><radialGradient id="mg" cx="40%" cy="38%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d7def2"/></radialGradient></defs>
    <circle cx="50" cy="50" r="40" fill="#1a2447" opacity=".55"/>
    <clipPath id="ml"><path d="${d}"/></clipPath>
    <path d="${d}" fill="url(#mg)"/>
    <g clip-path="url(#ml)" fill="#b9c3e0" opacity=".6"><circle cx="40" cy="40" r="5"/><circle cx="58" cy="56" r="7"/><circle cx="46" cy="62" r="3.5"/><circle cx="62" cy="36" r="3"/></g>
  </svg>`;
}

let moonDrawnFor = '';

function render(timeOnly = false) {
  const { kind, cloud, offset, sunrise, sunset, hourOverride, fxOn } = cfg;
  const t = hourOverride >= 0 ? hourOverride * 60 + 30 : localMinutes(offset);
  const e = elevation(t, sunrise, sunset);
  const isDay = t >= sunrise && t <= sunset;

  // --- رنگ آسمان ---
  const w = WX[kind] || WX.clear;
  let [top, mid, bot] = paletteAt(e);
  const gray = Math.max(w.gray, clamp(cloud / 100) * 0.55);
  const shade = (c) => {
    const L = lum(c);
    let r = lerpC(c, [L, L, L * 1.04], gray);
    r = r.map((v) => v * w.dark);
    return lerpC(r, [210, 220, 232], w.lift * (e > 0 ? 1 : 0.25));
  };
  [top, mid, bot] = [top, mid, bot].map(shade);
  root.style.setProperty('--sky-top', css(top));
  root.style.setProperty('--sky-mid', css(mid));
  root.style.setProperty('--sky-bot', css(bot));

  // رنگ ابر
  const base = lerpC(mid, [255, 255, 255], clamp(0.3 + e * 0.5, 0.12, 0.6));
  const dark = kind === 'storm' ? 0.55 : kind === 'rain' ? 0.72 : kind === 'drizzle' ? 0.8 : 1;
  const cc = base.map((v) => v * dark);
  root.style.setProperty('--cloud-rgb', cc.map(Math.round).join(','));

  // شیشه در آسمان روشن‌تر، تیره‌تر می‌شود تا خوانایی متن حفظ شود
  const bright = lerp(lum(mid), lum(cc), clamp(cloud / 100) * 0.8);
  root.style.setProperty('--tint', clamp(0.26 + (bright - 105) / 150 * 0.45, 0.26, 0.7).toFixed(2));

  // --- درخشش افق (طلوع/غروب) ---
  const glowA = clamp(1 - Math.abs(e - 0.0) / 0.22) * (1 - gray * 0.7);
  const glowEl = $('horizon-glow');
  glowEl.style.opacity = glowA.toFixed(3);

  // --- خورشید / ماه ---
  const orb = $('orb');
  let p, kindOrb;
  if (isDay) { p = (t - sunrise) / (sunset - sunrise); kindOrb = 'sun'; }
  else {
    const nightLen = 1440 - (sunset - sunrise);
    const dt = t > sunset ? t - sunset : t + 1440 - sunset;
    p = dt / nightLen; kindOrb = 'moon';
  }
  const x = 8 + 84 * p;
  const y = 88 - 82 * Math.sin(Math.PI * p);
  orb.style.left = x + '%';
  orb.style.top = y + 'vh';
  glowEl.style.left = x + '%';
  orb.className = 'orb ' + kindOrb;
  const hide = clamp(Math.sin(Math.PI * p) * 5) * (1 - clamp(cloud / 100) * (kind === 'clear' || kind === 'partly' ? 0.5 : 0.92));
  orb.style.opacity = hide.toFixed(3);
  if (kindOrb === 'moon') {
    const key = new Date().toDateString();
    if (moonDrawnFor !== key || !orb.firstChild) { orb.innerHTML = moonSvg(); moonDrawnFor = key; }
  } else if (orb.firstChild) { orb.innerHTML = ''; moonDrawnFor = ''; }
  // رنگ خورشید نزدیک افق نارنجی‌تر
  const warm = clamp(1 - e / 0.45);
  root.style.setProperty('--sun-core', css(lerpC([255, 248, 214], [255, 190, 120], warm)));
  root.style.setProperty('--sun-halo', css(lerpC([255, 214, 110], [255, 120, 60], warm)));

  // --- ستاره‌ها ---
  fx.stars = clamp(-e * 3.2) * (1 - clamp(cloud / 100) * 0.95) * (kind === 'fog' ? 0.2 : 1);

  // برای حالت‌های بدون‌نیاز به بازسازی
  if (timeOnly) return;
  buildClouds(kind, cloud, fxOn);
  const fog = $('fog');
  fog.style.opacity = (kind === 'fog' ? 0.95 : (kind === 'rain' || kind === 'drizzle' ? 0.18 : 0)) * (fxOn ? 1 : 0.5);
  document.body.dataset.scene = isDay ? 'day' : 'night';
}

// ---------- ابرها ----------
function buildClouds(kind, cloud, fxOn) {
  const layer = $('clouds');
  const key = `${kind}|${Math.round(cloud / 12)}|${fxOn}|${innerWidth > 900}`;
  if (key === cloudKey) return;
  cloudKey = key;
  layer.innerHTML = '';
  if (kind === 'fog') return;
  let n = Math.round(clamp(cloud / 100) * 9);
  if (kind === 'partly') n = Math.max(n, 3);
  if (cloud > 10) n = Math.max(n, 2);
  if (!fxOn) n = Math.min(n, 3);
  const lowSky = ['rain', 'storm', 'drizzle', 'cloudy'].includes(kind);
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'cloud';
    const w = 260 + Math.random() * 420;
    c.style.width = w + 'px';
    c.style.height = w * 0.42 + 'px';
    c.style.top = (lowSky ? Math.random() * 38 - 6 : Math.random() * 46) + 'vh';
    c.style.opacity = (0.45 + Math.random() * 0.45).toFixed(2);
    c.style.animationDuration = (90 + Math.random() * 120) + 's';
    c.style.animationDelay = -(Math.random() * 200) + 's';
    layer.appendChild(c);
  }
}

// ---------- بوم: ستاره، باران، برف، رعد ----------
const cv = $('fx');
const ctx = cv.getContext('2d');
let W = 0, H = 0, dpr = 1;
let stars = [], drops = [], flakes = [];
let raf = 0, last = 0, bolt = null, nextBolt = 0;

// ---- موتور Rust/WebAssembly (js/sky_fx.wasm). اگر بارگذاری نشد، همان شبیه‌سازی جاوااسکریپت کار می‌کند ----
let wasm = null;
const engineEl = () => document.getElementById('fx-engine');
(async () => {
  try {
    const res = await fetch(new URL('./sky_fx.wasm', import.meta.url));
    const { instance } = await WebAssembly.instantiate(await res.arrayBuffer(), {});
    wasm = instance.exports;
    if (W) { resize(); if (cfg) syncFx(); }
    if (engineEl()) engineEl().textContent = 'موتور افکت‌ها: Rust / WebAssembly ✓';
  } catch {
    if (engineEl()) engineEl().textContent = 'موتور افکت‌ها: جاوااسکریپت (WebAssembly بارگذاری نشد)';
  }
})();
const f32 = (ptr, n) => new Float32Array(wasm.memory.buffer, ptr, n);

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  W = innerWidth; H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (wasm) wasm.init(W, H, (Math.random() * 4294967295) >>> 0);
  stars = wasm ? [] : Array.from({ length: Math.round(W * H / 9000) }, () => ({
    x: Math.random() * W, y: Math.random() * H * 0.78,
    r: Math.random() * 1.2 + 0.3, ph: Math.random() * 6.28, sp: Math.random() * 2 + 0.6,
  }));
  seedPrecip();
}
addEventListener('resize', () => { resize(); drawStatic(); });

function seedPrecip() {
  const area = W * H;
  const per = fx.mode === 'rain' ? (fx.storm ? 2800 : fx.heavy ? 3200 : 6500) : fx.mode === 'drizzle' ? 11000 : fx.mode === 'snow' ? (fx.heavy ? 5500 : 11000) : 0;
  const n = per ? Math.round(area / per) : 0;
  if (wasm) {
    const id = fx.mode === 'rain' ? 1 : fx.mode === 'drizzle' ? 2 : fx.mode === 'snow' ? 3 : 0;
    wasm.set_mode(id, n, fx.storm ? 1 : 0);
    drops = []; flakes = [];
    return;
  }
  if (fx.mode === 'rain' || fx.mode === 'drizzle') {
    const k = fx.mode === 'drizzle' ? 0.55 : 1;
    drops = Array.from({ length: n }, () => ({
      x: Math.random() * (W + 200) - 100, y: Math.random() * H,
      len: (10 + Math.random() * 16) * k, sp: (700 + Math.random() * 500) * (fx.storm ? 1.25 : 1) * k,
    }));
    flakes = [];
  } else if (fx.mode === 'snow') {
    flakes = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: 1 + Math.random() * 2.6, sp: 30 + Math.random() * 50, ph: Math.random() * 6.28,
    }));
    drops = [];
  } else { drops = []; flakes = []; }
}

function syncFx() {
  const { kind, code, fxOn } = cfg;
  const heavy = [65, 67, 75, 82, 86, 96, 99].includes(code);
  let mode = 'none';
  if (fxOn && !reduced.matches) {
    if (kind === 'rain' || kind === 'storm') mode = 'rain';
    else if (kind === 'drizzle') mode = 'drizzle';
    else if (kind === 'snow') mode = 'snow';
  }
  const changed = mode !== fx.mode || heavy !== fx.heavy || (kind === 'storm') !== fx.storm;
  fx.mode = mode; fx.heavy = heavy; fx.storm = kind === 'storm' && fxOn && !reduced.matches;
  if (!W) resize(); else if (changed) seedPrecip();
  cv.style.display = cfg.fxOn || fx.stars > 0 ? '' : 'none';
  if (reduced.matches || !cfg.fxOn) { stop(); drawStatic(); }
  else start();
}

function start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop(); else if (cfg && cfg.fxOn && !reduced.matches) start();
});
reduced.addEventListener?.('change', () => cfg && syncFx());

function drawStars(ts) {
  if (fx.stars <= 0.01) return;
  ctx.fillStyle = '#fff';
  if (wasm) {
    wasm.stars_step(reduced.matches ? 0 : ts / 1000);
    const a = f32(wasm.stars_ptr(), wasm.stars_len() * 4);
    for (let i = 0; i < a.length; i += 4) {
      ctx.globalAlpha = fx.stars * a[i + 3] * 0.9;
      ctx.beginPath(); ctx.arc(a[i], a[i + 1], a[i + 2], 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    return;
  }
  for (const s of stars) {
    const tw = reduced.matches ? 1 : 0.6 + 0.4 * Math.sin(ts / 1000 * s.sp + s.ph);
    ctx.globalAlpha = fx.stars * tw * 0.9;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawStatic() {
  if (!W) return;
  ctx.clearRect(0, 0, W, H);
  drawStars(0);
}

function makeBolt() {
  if (wasm) {
    const n = wasm.make_bolt((Math.random() * 4294967295) >>> 0);
    const a = f32(wasm.bolt_ptr(), n * 2);
    const pts = [];
    for (let i = 0; i < a.length; i += 2) pts.push([a[i], a[i + 1]]);
    return { pts, t0: performance.now() };
  }
  const pts = [];
  let x = W * (0.15 + Math.random() * 0.7), y = 0;
  while (y < H * (0.45 + Math.random() * 0.3)) {
    pts.push([x, y]);
    x += (Math.random() - 0.5) * 70; y += 20 + Math.random() * 40;
  }
  return { pts, t0: performance.now() };
}

function frame(ts) {
  raf = requestAnimationFrame(frame);
  if (ts - last < 32) return;
  const dt = last ? Math.min((ts - last) / 1000, 0.1) : 0.032;
  last = ts;
  ctx.clearRect(0, 0, W, H);
  drawStars(ts);

  if (wasm && fx.mode !== 'none') {
    wasm.step(dt);
    const a = f32(wasm.particles_ptr(), wasm.particles_len() * 4);
    if (fx.mode === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < a.length; i += 4) { ctx.beginPath(); ctx.arc(a[i], a[i + 1], a[i + 2], 0, 6.283); ctx.fill(); }
    } else {
      ctx.strokeStyle = fx.mode === 'drizzle' ? 'rgba(200,220,255,.28)' : 'rgba(200,222,255,.42)';
      ctx.lineWidth = fx.mode === 'drizzle' ? 1 : 1.3;
      ctx.beginPath();
      for (let i = 0; i < a.length; i += 4) { ctx.moveTo(a[i], a[i + 1]); ctx.lineTo(a[i] + a[i + 2], a[i + 1] + a[i + 3]); }
      ctx.stroke();
    }
  } else if (fx.mode === 'rain' || fx.mode === 'drizzle') {
    ctx.strokeStyle = fx.mode === 'drizzle' ? 'rgba(200,220,255,.28)' : 'rgba(200,222,255,.42)';
    ctx.lineWidth = fx.mode === 'drizzle' ? 1 : 1.3;
    ctx.beginPath();
    for (const d of drops) {
      d.y += d.sp * dt; d.x -= d.sp * dt * 0.18;
      if (d.y > H) { d.y = -d.len; d.x = Math.random() * (W + 200) - 100 + 60; }
      ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.len * 0.18, d.y - d.len);
    }
    ctx.stroke();
  } else if (fx.mode === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (const f of flakes) {
      f.y += f.sp * dt; f.ph += dt;
      f.x += Math.sin(f.ph * 1.2) * 18 * dt;
      if (f.y > H + 5) { f.y = -5; f.x = Math.random() * W; }
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
    }
  }

  if (fx.storm) {
    const now = performance.now();
    if (!nextBolt) nextBolt = now + 2500 + Math.random() * 4000;
    if (now > nextBolt && !bolt) {
      bolt = makeBolt();
      const fl = $('flash');
      fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
      nextBolt = now + 4000 + Math.random() * 6000;
    }
    if (bolt) {
      const age = now - bolt.t0;
      if (age > 260) bolt = null;
      else {
        ctx.globalAlpha = 1 - age / 260;
        ctx.strokeStyle = '#eaf2ff'; ctx.lineWidth = 2.2;
        ctx.shadowColor = '#9cc4ff'; ctx.shadowBlur = 18;
        ctx.beginPath();
        bolt.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
    }
  }
}

export { kindOf };
