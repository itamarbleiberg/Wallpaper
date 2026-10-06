# AquaWall — interactive live wallpapers for Windows 11

AquaWall renders an **interactive water pool**, **videos** (local files or TikTok / YouTube Shorts / Reels links) and **GLSL shaders** behind your desktop icons. Your cursor makes ripples in the water.

## Install (no build needed)

1. Open the repo's **Releases** page and pick **Latest build**. You can also open **Actions → Build Windows installer** and download the `AquaWall-windows` artifact from the newest run.
2. Run `AquaWall_1.0.0_x64-setup.exe`. It installs per-user, so you don't need admin rights.
3. AquaWall starts with the *Interactive Pool* wallpaper and opens the settings window. Closing the window keeps it running in the system tray.

> The installer isn't code-signed, so Windows SmartScreen may warn you. Click **More info → Run anyway**.

## Features

| Area | What you get |
|---|---|
| Default wallpaper | GPU water simulation driven by the mouse, with velocity-based wakes, a spring-smoothed cursor and click splashes. Includes refraction, Beer-Lambert absorption, animated plus ripple-focused caustics, Fresnel sky reflection and sun glints. Clarity, wave speed, refraction, caustics, persistence, depth, colors and floor style are all adjustable. |
| Video | MP4 / WEBM / MOV import, drag & drop, and URL download via yt-dlp. A timeline lets you drag **In/Out** handles and shows thumbnails; **I/O/Space/←→** shortcuts work too. Speed runs from 0.25× to 4×. Loop modes are standard (two decoders, no seek hitch), crossfade (blended in the shader) and ping-pong. Real-time frame blending is available. |
| 4K bake (ffmpeg) | Renders the trimmed loop to a new MP4. Options include motion-compensated or blended 60 fps interpolation, Lanczos upscale to 1440p/4K, unsharp sharpening, and x264/NVENC/QSV/AMF encoding. |
| Enhancement | Real-time Catmull-Rom upscaling and contrast-adaptive sharpening. Brightness, contrast, saturation, vibrance, gamma and temperature controls. Blur, vignette and grain. Render-scale and FPS caps. |
| Overlays | Ripple refraction on any video or shader, cursor particles and light trails. Widgets: clock, weather (Open-Meteo), audio visualizer (system-audio loopback) and CPU/RAM rings. |
| Desktop | Embeds behind icons via `Progman`/`WorkerW`, including the Windows 11 24H2 layout. Falls back to a bottom-most window if that fails and re-attaches after Explorer restarts. Multi-monitor modes: independent, clone or span. |
| Performance | Per-display pause or mute while a fullscreen or maximized app is focused. Pause or 30 fps throttle on battery or Battery Saver. A paused wallpaper renders nothing. |
| Tray | Pause/resume, quick wallpaper switching, open settings, re-attach and exit. |

## Architecture

```
Tauri 2 (Rust)                                   WebView2 (React + WebGL2)
├─ desktop/win.rs   WorkerW/Progman embedding,   ├─ wallpaper.html  one window per display
│                   fullscreen/battery/cursor    │   └─ engine/Renderer.ts
├─ wallpaper.rs     per-monitor windows          │       ├─ WaterSim.ts     height-field sim + pool shader
├─ input.rs         global cursor → "cursor"     │       ├─ VideoSource.ts  dual-decoder loops, frame blend
├─ perf.rs          pause/mute/throttle watchdog │       ├─ ShaderSource.ts Shadertoy-compatible
├─ protocol.rs      wallvid:// range streaming   │       ├─ PostFX.ts       CAS, grading, blur, vignette
├─ media.rs         yt-dlp + ffmpeg jobs         │       └─ TrailFX.ts      particles + light trail
├─ audio.rs         WASAPI loopback FFT          └─ index.html     settings UI (panels, timeline, preview)
├─ sysmon.rs        CPU / RAM
└─ tray.rs          system tray
```

Windows behind the desktop icons never receive mouse input. Instead, Rust polls `GetCursorPos` at a configurable rate (120 Hz by default) and broadcasts the position. Each wallpaper window converts it to its own coordinates.

## Build from source (Windows)

Prerequisites: [Rust](https://rustup.rs), Node.js 20+, Visual Studio Build Tools with the "Desktop development with C++" workload, and the WebView2 runtime (already included in Windows 11).

```powershell
npm install
powershell -ExecutionPolicy Bypass -File scripts/fetch-tools.ps1   # bundles ffmpeg + yt-dlp (optional)
npm run tauri dev      # run with hot reload
npm run tauri build    # installers in src-tauri/target/release/bundle/{nsis,msi}
```

`npm run dev` also runs the UI in a normal browser (settings at `/`, wallpaper at `/wallpaper.html`). Config is stored in localStorage in that mode, so you can work on the engine without Rust.

## Notes

- Live ping-pong reverses playback by seeking. For perfectly smooth reverse playback, use **Bake**.
- Videos must use a codec WebView2 can decode (H.264/VP9/AV1). HEVC/ProRes `.mov` files can be converted with **Bake**.
- Only download videos you have the right to use.
