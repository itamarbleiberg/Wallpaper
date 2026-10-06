# AquaWall: interactive live wallpapers for Windows 11

AquaWall puts an **interactive water pool**, a **koi pond**, **videos** (local files or TikTok / YouTube Shorts / Reels links), **photos** and **GLSL shaders** behind your desktop icons. Your mouse makes ripples, startles the fish and pushes the lily pads around.

## Install (no build needed)

1. Open the repo's **Releases** page and pick **Latest build**, or download the `AquaWall-windows` artifact from **Actions**.
2. Run `AquaWall_2.0.0_x64-setup.exe`. It installs per-user, so you don't need admin rights.
3. AquaWall opens on the Gallery. Closing the window keeps it running in the system tray.

> The installer isn't code-signed, so Windows SmartScreen may warn you. Click **More info → Run anyway**.

## What's inside

**33 built-in wallpapers**
- **Water (9):** Interactive Pool, Midnight Pool, Lagoon Sand, Koi Pond, Zen Lily Garden, Rainy Koi Pond, Neon Night Swim, Mosaic Spa, Glacier Lagoon.
- **Shaders (24):** Aurora Veil, Neon Horizon, Liquid Plasma, Deep Space Drift, Nebula Bloom, Ocean Sunset, Rain on Glass, Lava Lamp, Digital Rain, Firefly Forest, Snowy Peaks, Neon Tunnel, Ink Bloom, Desert Dunes, Hex Pulse, Bokeh Dreams, Spiral Galaxy, Sunbeams Below, Silk Gradient, Liquid Chrome, Sakura Drift, Thunderstorm, Windy Meadow, Outrun Sunset.

**Features**

| Area | What you get |
|---|---|
| Gallery | Live-rendered thumbnails, categories, search, favorites, drag & drop import, "Surprise me" |
| Water engine | GPU wave simulation with refraction, caustics, sun glints, and tile/mosaic/pebble/sand floors. Koi fish flee your cursor and lily pads drift and bob on the waves. Underwater pool lights. Click effects: splash, shockwave or bubbles |
| Video | Timeline trimmer with In/Out handles, 0.25×–4× speed, seamless/crossfade/ping-pong loops, real-time frame blending, and a 4K **bake** to MP4 via ffmpeg (60 fps interpolation, Lanczos upscale, NVENC/QSV/AMF) |
| Images | Photo wallpapers with Ken Burns pan & zoom |
| Effects | Water ripples over any wallpaper, cursor sparks/light trails, mouse parallax, beat pulse and music-driven ripples (from system audio) |
| Enhance | CAS sharpening, bicubic upscaling, color grading, blur, vignette, grain, one-click looks |
| Widgets | Clock (3 styles), weather, audio visualizer, CPU/RAM/battery, custom text, countdown |
| Automation | Playlist rotation, time-of-day schedule, night mode (dim + warm), crossfade/ripple transitions, global hotkeys |
| Displays | Per-display wallpapers, clone or span modes, a live monitor map and embedding diagnostics |
| Performance | Pause for fullscreen games, maximized apps, battery or idle time, plus an app blocklist and an FPS overlay |
| Settings | Windows wallpaper sync (lock screen / Task View), screenshots, export/import wallpapers, full backup & restore, accent colors, undo/redo |

Default hotkeys: **Ctrl+Alt+P** pause, **Ctrl+Alt+→/←** next/previous, **Ctrl+Alt+M** mute, **Ctrl+Alt+W** open AquaWall.

## Multi-monitor note (fixed in 2.0)

On Windows 11 24H2+ every wallpaper window is a child of `Progman`, stacked between the icons and the static wallpaper (`WorkerW`). Version 1 put `WorkerW` directly below whichever window was attached last, which hid the earlier windows, so only one display showed a wallpaper. Version 2 pushes `WorkerW` to the bottom and re-stacks all windows after every change. **Displays → Run diagnostics** shows the live stacking order.

## Architecture

```
Tauri 2 (Rust)                                    WebView2 (React + WebGL2)
├─ desktop/win.rs   WorkerW/Progman embedding,    ├─ wallpaper.html  one window per display
│                   z-order, fullscreen, idle,    │   └─ engine/Renderer.ts  transitions, parallax, beats
│                   power, process names          │       ├─ WaterSim.ts + PondLife.ts  water, koi, lily pads
├─ wallpaper.rs     per-monitor windows           │       ├─ VideoSource.ts / ImageSource.ts
├─ automation.rs    playlist + schedule           │       ├─ ShaderSource.ts + shaderLibrary.ts (24 shaders)
├─ hotkeys.rs       global shortcuts              │       ├─ PostFX.ts  CAS, grading, parallax, pulse
├─ perf.rs          pause/mute/dim watchdog       │       └─ TrailFX.ts sparks + light trails
├─ input.rs         global cursor broadcast       └─ index.html  settings app (gallery, editor, pages)
├─ protocol.rs      wallvid:// range streaming
├─ media.rs         yt-dlp + ffmpeg jobs
├─ audio.rs         WASAPI loopback FFT
└─ tray.rs          tray menu (favorites, next, mute…)
```

## Build from source (Windows)

Prerequisites: [Rust](https://rustup.rs), Node.js 20+, and Visual Studio Build Tools with the "Desktop development with C++" workload.

```powershell
npm install
powershell -ExecutionPolicy Bypass -File scripts/fetch-tools.ps1   # bundles ffmpeg + yt-dlp
npm run tauri dev      # run with hot reload
npm run tauri build    # installers in src-tauri/target/release/bundle/{nsis,msi}
```

`npm run dev` also runs the UI in a normal browser (settings at `/`, wallpaper at `/wallpaper.html`). Config is stored in localStorage in that mode.

Only download videos you have the right to use.
