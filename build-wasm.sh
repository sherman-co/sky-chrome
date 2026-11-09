#!/usr/bin/env sh
# ساخت موتور افکت‌ها (Rust → WebAssembly). پیش‌نیاز: rustup target add wasm32-unknown-unknown
set -e
cd "$(dirname "$0")"
cargo build --release --target wasm32-unknown-unknown --manifest-path wasm/Cargo.toml
cp wasm/target/wasm32-unknown-unknown/release/sky_fx.wasm js/sky_fx.wasm
ls -l js/sky_fx.wasm
