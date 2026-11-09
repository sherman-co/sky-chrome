// دریافت و نرمال‌سازی داده‌های Open-Meteo + متن فارسی + آیکون‌ها

const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';

// کد WMO → وضعیت
const CODES = {
  0: ['clear', 'صاف'],
  1: ['clear', 'عمدتاً صاف'],
  2: ['partly', 'کمی ابری'],
  3: ['cloudy', 'ابری'],
  45: ['fog', 'مه‌آلود'],
  48: ['fog', 'مه یخ‌زده'],
  51: ['drizzle', 'نم‌نم باران ملایم'],
  53: ['drizzle', 'نم‌نم باران'],
  55: ['drizzle', 'نم‌نم باران شدید'],
  56: ['drizzle', 'نم‌نم یخ‌زده'],
  57: ['drizzle', 'نم‌نم یخ‌زدهٔ شدید'],
  61: ['rain', 'باران ملایم'],
  63: ['rain', 'بارانی'],
  65: ['rain', 'باران شدید'],
  66: ['rain', 'باران یخ‌زده'],
  67: ['rain', 'باران یخ‌زدهٔ شدید'],
  71: ['snow', 'برف ملایم'],
  73: ['snow', 'برفی'],
  75: ['snow', 'برف سنگین'],
  77: ['snow', 'دانه‌های برف'],
  80: ['rain', 'رگبار ملایم'],
  81: ['rain', 'رگبار'],
  82: ['rain', 'رگبار شدید'],
  85: ['snow', 'رگبار برف'],
  86: ['snow', 'رگبار برف شدید'],
  95: ['storm', 'رعد و برق'],
  96: ['storm', 'رعد و برق با تگرگ'],
  99: ['storm', 'رعد و برق با تگرگ شدید'],
};

export const kindOf = (code) => (CODES[code] || ['cloudy', 'نامشخص'])[0];
export const textOf = (code) => (CODES[code] || ['cloudy', 'نامشخص'])[1];

// برای پیش‌نمایش
const SIM = {
  clear: { code: 0, cloud: 5 },
  partly: { code: 2, cloud: 45 },
  cloudy: { code: 3, cloud: 95 },
  fog: { code: 45, cloud: 100 },
  drizzle: { code: 53, cloud: 90 },
  rain: { code: 63, cloud: 100 },
  snow: { code: 73, cloud: 100 },
  storm: { code: 95, cloud: 100 },
};

// ---- آیکون‌ها (SVG داخلی) ----
const SUN = '<g stroke="#FFD66B" stroke-width="3.2" stroke-linecap="round"><path d="M32 8v6M32 50v6M8 32h6M50 32h6M15 15l4.2 4.2M44.8 44.8L49 49M15 49l4.2-4.2M44.8 19.2L49 15"/></g><circle cx="32" cy="32" r="11" fill="#FFD66B"/>';
const MOON = '<path d="M41 12a21 21 0 1 0 12 33 17 17 0 0 1-12-33z" fill="#E8EEFF"/><circle cx="26" cy="36" r="2.2" fill="#C9D3F0"/><circle cx="34" cy="44" r="1.6" fill="#C9D3F0"/>';
const CLOUD = '<path d="M19 47a10 10 0 0 1-1.5-19.9A14 14 0 0 1 44.600 29 8.500 8.500 0 0 1 45 47z" fill="#F4F7FC"/>';
const CLOUD_GRAY = '<path d="M19 40a10 10 0 0 1-1.5-19.9A14 14 0 0 1 44.600 22 8.500 8.500 0 0 1 45 40z" fill="#DDE5F0"/>';

export function icon(kind, isDay = true) {
  const body = {
    clear: isDay ? SUN : MOON,
    partly: `<g transform="translate(-7 -9) scale(.78)">${isDay ? SUN : MOON}</g><g transform="translate(6 4)">${CLOUD}</g>`,
    cloudy: `<g transform="translate(0 2)">${CLOUD}</g>`,
    fog: `<g transform="translate(0 -8)">${CLOUD_GRAY}</g><g stroke="#DDE5F0" stroke-width="3.4" stroke-linecap="round"><path d="M14 46h36M20 53h28"/></g>`,
    drizzle: `${CLOUD_GRAY}<g stroke="#8FD0FF" stroke-width="3" stroke-linecap="round"><path d="M24 47v3M32 50v3M40 47v3"/></g>`,
    rain: `${CLOUD_GRAY}<g stroke="#6CC1FF" stroke-width="3.4" stroke-linecap="round"><path d="M23 46l-2 8M32 46l-2 8M41 46l-2 8"/></g>`,
    snow: `${CLOUD_GRAY}<g fill="#fff"><circle cx="23" cy="49" r="2.6"/><circle cx="32" cy="54" r="2.6"/><circle cx="41" cy="49" r="2.6"/></g>`,
    storm: `<path d="M19 38a10 10 0 0 1-1.500-19.900A14 14 0 0 1 44.600 20 8.500 8.500 0 0 1 45 38z" fill="#B9C4D6"/><path d="M34 34l-9 13h7l-3 11 11-15h-7z" fill="#FFD84D"/>`,
  }[kind] || '';
  return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">${body}</svg>`;
}

// ---- واکنشی‌ها ----
const toMin = (iso) => {
  if (!iso) return null;
  const t = iso.split('T')[1];
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export function windDirText(deg) {
  const names = ['شمال', 'شمال‌شرق', 'شرق', 'جنوب‌شرق', 'جنوب', 'جنوب‌غرب', 'غرب', 'شمال‌غرب'];
  return names[Math.round(((deg % 360) / 45)) % 8];
}

// ساعت و دقیقهٔ فعلی در منطقهٔ زمانی مکان (دقیقه از نیمه‌شب)
export function localMinutes(offsetSec, date = new Date()) {
  if (typeof offsetSec !== 'number') return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
  const d = new Date(date.getTime() + offsetSec * 1000);
  return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
}

export async function fetchWeather(loc) {
  const q = new URLSearchParams({
    latitude: loc.lat, longitude: loc.lon,
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m',
    hourly: 'temperature_2m,weather_code,precipitation_probability',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max',
    timezone: 'auto', forecast_days: 5, wind_speed_unit: 'kmh',
  });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch(`${FORECAST}?${q}`, { signal: ctl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return normalize(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

function normalize(j) {
  const c = j.current, d = j.daily, h = j.hourly;
  // ساعت‌های بعد
  const curHourIso = c.time.slice(0, 13); // YYYY-MM-DDTHH
  let start = h.time.findIndex((t) => t.slice(0, 13) === curHourIso);
  if (start < 0) start = 0;
  const hourly = [];
  for (let i = start; i < Math.min(start + 9, h.time.length); i++) {
    hourly.push({
      hour: Number(h.time[i].slice(11, 13)),
      temp: h.temperature_2m[i],
      code: h.weather_code[i],
      pop: h.precipitation_probability ? h.precipitation_probability[i] : null,
      isDay: null,
    });
  }
  const daily = d.time.map((date, i) => ({
    date, code: d.weather_code[i],
    max: d.temperature_2m_max[i], min: d.temperature_2m_min[i],
    pop: d.precipitation_probability_max ? d.precipitation_probability_max[i] : null,
  }));
  return {
    fetchedAt: Date.now(),
    tz: j.timezone, offset: j.utc_offset_seconds,
    now: {
      temp: c.temperature_2m, feels: c.apparent_temperature, humidity: c.relative_humidity_2m,
      isDay: !!c.is_day, precip: c.precipitation, code: c.weather_code, cloud: c.cloud_cover,
      wind: c.wind_speed_10m, windDir: c.wind_direction_10m,
    },
    sunrise: toMin(d.sunrise[0]) ?? 360,
    sunset: toMin(d.sunset[0]) ?? 1080,
    sunriseStr: (d.sunrise[0] || '').slice(11, 16),
    sunsetStr: (d.sunset[0] || '').slice(11, 16),
    hourly, daily,
  };
}

// اعمال پیش‌نمایش روی داده
export function applySim(w, simKind) {
  if (!w || !simKind || simKind === 'auto') return w;
  const s = SIM[simKind];
  if (!s) return w;
  return { ...w, now: { ...w.now, code: s.code, cloud: s.cloud } };
}

export async function searchCity(name) {
  const q = new URLSearchParams({ name, count: 6, language: 'fa', format: 'json' });
  const res = await fetch(`${GEOCODE}?${q}`);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  return (j.results || []).map((r) => ({
    lat: r.latitude, lon: r.longitude, name: r.name,
    sub: [r.admin1, r.country].filter(Boolean).join('، '),
  }));
}

export const toF = (c) => c * 9 / 5 + 32;
