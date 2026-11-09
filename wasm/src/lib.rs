//! موتور ذرات آب‌وهوا برای Sky Tab (باران، نم‌نم، برف، ستاره‌ها، رعد و برق).
//! بدون وابستگی و بدون std: جاوااسکریپت فقط حافظه را می‌خواند و روی Canvas می‌کشد.
//!
//! چیدمان بافرها (همه f32):
//!   ذرات   : [x, y, a, b]  — باران: خط از (x,y) تا (x+a, y+b)؛ برف: دایره‌ای به مرکز (x,y) و شعاع a
//!   ستاره‌ها: [x, y, شعاع, شفافیت]
//!   رعد    : [x, y] نقطه‌های یک خط شکسته
#![no_std]

use core::panic::PanicInfo;

#[panic_handler]
fn panic(_: &PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

const MAX_P: usize = 6000;
const MAX_S: usize = 600;
const MAX_B: usize = 64;
const PI: f32 = 3.141_592_7;
const TAU: f32 = 6.283_185_5;

const MODE_NONE: u32 = 0;
const MODE_RAIN: u32 = 1;
const MODE_DRIZZLE: u32 = 2;
const MODE_SNOW: u32 = 3;

struct State {
    w: f32,
    h: f32,
    rng: u32,
    mode: u32,
    storm: bool,
    n: usize,
    p: [[f32; 4]; MAX_P],
    v: [[f32; 2]; MAX_P], // سرعت، فاز
    ns: usize,
    stars: [[f32; 4]; MAX_S],
    star_meta: [[f32; 2]; MAX_S], // سرعت چشمک، فاز
    nb: usize,
    bolt: [[f32; 2]; MAX_B],
}

static mut ST: State = State {
    w: 0.0,
    h: 0.0,
    rng: 0, // در init مقداردهی می‌شود (صفر نگه داشته شده تا در .bss بماند و حجم فایل کم باشد)
    mode: MODE_NONE,
    storm: false,
    n: 0,
    p: [[0.0; 4]; MAX_P],
    v: [[0.0; 2]; MAX_P],
    ns: 0,
    stars: [[0.0; 4]; MAX_S],
    star_meta: [[0.0; 2]; MAX_S],
    nb: 0,
    bolt: [[0.0; 2]; MAX_B],
};

#[inline]
fn st() -> &'static mut State {
    // wasm تک‌نخی است؛ دسترسی منحصربه‌فرد است.
    unsafe { &mut *(&raw mut ST) }
}

fn rnd(s: &mut State) -> f32 {
    let mut x = s.rng;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    s.rng = x;
    (x >> 8) as f32 / 16_777_216.0
}

fn floor(x: f32) -> f32 {
    let t = x as i32 as f32;
    if t > x { t - 1.0 } else { t }
}

/// تقریب سریع سینوس (Bhaskara) — دقت برای انیمیشن کافی است.
fn sin(x: f32) -> f32 {
    let k = floor((x + PI) * (1.0 / TAU));
    let r = x - k * TAU; // [-π, π)
    let (a, sign) = if r < 0.0 { (-r, -1.0) } else { (r, 1.0) };
    let t = a * (PI - a);
    sign * 16.0 * t / (5.0 * PI * PI - 4.0 * t)
}

fn spawn_rain(s: &mut State, i: usize, anywhere: bool) {
    let k = if s.mode == MODE_DRIZZLE { 0.55 } else { 1.0 };
    let len = (10.0 + rnd(s) * 16.0) * k;
    let sp = (700.0 + rnd(s) * 500.0) * if s.storm { 1.25 } else { 1.0 } * k;
    let x = rnd(s) * (s.w + 200.0) - 40.0;
    let y = if anywhere { rnd(s) * s.h } else { -len };
    s.p[i] = [x, y, len * 0.18, -len];
    s.v[i] = [sp, 0.0];
}

fn spawn_snow(s: &mut State, i: usize, anywhere: bool) {
    let r = 1.0 + rnd(s) * 2.6;
    let sp = 30.0 + rnd(s) * 50.0;
    let ph = rnd(s) * TAU;
    let x = rnd(s) * s.w;
    let y = if anywhere { rnd(s) * s.h } else { -5.0 };
    s.p[i] = [x, y, r, 0.0];
    s.v[i] = [sp, ph];
}

/// اندازهٔ صفحه را تنظیم می‌کند و ستاره‌ها را می‌سازد.
#[no_mangle]
pub extern "C" fn init(w: f32, h: f32, seed: u32) {
    let s = st();
    s.w = if w > 1.0 { w } else { 1.0 };
    s.h = if h > 1.0 { h } else { 1.0 };
    s.rng = if seed == 0 { 0x9E37_79B9 } else { seed };
    let want = (s.w * s.h / 9000.0) as usize;
    s.ns = if want < MAX_S { want } else { MAX_S };
    for i in 0..s.ns {
        let x = rnd(s) * s.w;
        let y = rnd(s) * s.h * 0.78;
        let r = rnd(s) * 1.2 + 0.3;
        let sp = rnd(s) * 2.0 + 0.6;
        let ph = rnd(s) * TAU;
        s.stars[i] = [x, y, r, 0.0];
        s.star_meta[i] = [sp, ph];
    }
}

/// حالت بارش: 0 هیچ، 1 باران، 2 نم‌نم، 3 برف. `count` تعداد ذرات است.
#[no_mangle]
pub extern "C" fn set_mode(mode: u32, count: u32, storm: u32) {
    let s = st();
    s.mode = mode;
    s.storm = storm != 0;
    let c = count as usize;
    s.n = if mode == MODE_NONE { 0 } else if c < MAX_P { c } else { MAX_P };
    for i in 0..s.n {
        if mode == MODE_SNOW {
            spawn_snow(s, i, true);
        } else {
            spawn_rain(s, i, true);
        }
    }
}

/// یک گام شبیه‌سازی (dt بر حسب ثانیه).
#[no_mangle]
pub extern "C" fn step(dt: f32) {
    let s = st();
    let (w, h) = (s.w, s.h);
    match s.mode {
        MODE_RAIN | MODE_DRIZZLE => {
            for i in 0..s.n {
                let sp = s.v[i][0];
                s.p[i][1] += sp * dt;
                s.p[i][0] -= sp * dt * 0.18;
                if s.p[i][1] > h || s.p[i][0] < -100.0 {
                    spawn_rain(s, i, false);
                    s.p[i][0] += 60.0;
                }
            }
        }
        MODE_SNOW => {
            for i in 0..s.n {
                s.v[i][1] += dt;
                let ph = s.v[i][1];
                s.p[i][0] += sin(ph * 1.2) * 18.0 * dt;
                s.p[i][1] += s.v[i][0] * dt;
                if s.p[i][1] > h + 5.0 {
                    spawn_snow(s, i, false);
                } else if s.p[i][0] > w + 20.0 {
                    s.p[i][0] = -10.0;
                } else if s.p[i][0] < -20.0 {
                    s.p[i][0] = w + 10.0;
                }
            }
        }
        _ => {}
    }
}

/// شفافیت ستاره‌ها را برای زمان t (ثانیه) محاسبه می‌کند.
#[no_mangle]
pub extern "C" fn stars_step(t: f32) {
    let s = st();
    for i in 0..s.ns {
        let m = s.star_meta[i];
        s.stars[i][3] = 0.6 + 0.4 * sin(t * m[0] + m[1]);
    }
}

/// یک رعد (خط شکسته) می‌سازد و تعداد نقطه‌ها را برمی‌گرداند.
#[no_mangle]
pub extern "C" fn make_bolt(seed: u32) -> u32 {
    let s = st();
    s.rng ^= seed.wrapping_mul(2_654_435_761) | 1;
    let mut x = s.w * (0.15 + rnd(s) * 0.7);
    let mut y = 0.0;
    let limit = s.h * (0.45 + rnd(s) * 0.3);
    let mut n = 0;
    while y < limit && n < MAX_B {
        s.bolt[n] = [x, y];
        n += 1;
        x += (rnd(s) - 0.5) * 70.0;
        y += 20.0 + rnd(s) * 40.0;
    }
    s.nb = n;
    n as u32
}

#[no_mangle]
pub extern "C" fn particles_ptr() -> *const f32 {
    st().p.as_ptr() as *const f32
}
#[no_mangle]
pub extern "C" fn particles_len() -> u32 {
    st().n as u32
}
#[no_mangle]
pub extern "C" fn stars_ptr() -> *const f32 {
    st().stars.as_ptr() as *const f32
}
#[no_mangle]
pub extern "C" fn stars_len() -> u32 {
    st().ns as u32
}
#[no_mangle]
pub extern "C" fn bolt_ptr() -> *const f32 {
    st().bolt.as_ptr() as *const f32
}
