# AquaWall 4: interactive live wallpapers for Windows 11

AquaWall renders interactive water, videos, photos and GLSL scenes behind Windows desktop icons. It supports multi-monitor layouts, a professional Resolve-inspired editor, automation, widgets, music reactions and game-aware performance controls.

## Install

1. Download **AquaWall_4.0.0_x64-setup.exe** from the repo's **Latest build** release.
2. Run the per-user installer; administrator rights are not required.
3. Choose a wallpaper in Gallery. Closing the window leaves AquaWall running in the system tray.

The installer is not code-signed yet, so SmartScreen can show **More info → Run anyway**. Source and reproducible CI builds are public.

## Version 4

**53 built-in wallpapers**
- **Water (15):** Interactive Pool, Midnight Pool, Lagoon Sand, Koi Pond, Zen Lily Garden, Rainy Koi Pond, Neon Night Swim, Mosaic Spa, Glacier Lagoon, Tropical Reef, Hot Spring, Infinity Pool, Aurora Pool, Tide Pool and Blacklight Pool.
- **Shaders (38):** the 24 v3 scenes plus Hyperspace, Data Globe, Living Cells, Kaleido Mandala, Fluid Ink, Daydream Sky, Crystal Facets, Lens Flare, Endless Peaks, Spectrum Stage, Paper Layers, Rising Embers, Gravity Grid and Jelly Drift.

Real-camera nature video presets are intentionally reserved for **v4.1**, after their source links have been supplied and every clip can be individually trimmed, graded, tested and made into a seamless loop.

### Core features

| Area | What you get |
|---|---|
| Gallery | Live-rendered thumbnails, categories, search, favorites, drag-and-drop import and Surprise Me |
| Editor | Resolve-style Source/Edit/Transform/Color/Effects/Enhance workspace, color wheels, LUTs, crop, chroma key, keyframes, bloom, lens effects, scopes and non-destructive undo/redo |
| Help | Ctrl+K command center, quick-start checklist, readiness checks, shortcut guide, editor glossary, searchable troubleshooting and one-click desktop repair |
| Water | GPU wave simulation, refraction, caustics, five floor styles, koi, lily pads, underwater lights and three click effects |
| Video | In/Out timeline, 0.25×–4× speed, seamless/crossfade/ping-pong loops, frame blending and 4K ffmpeg baking |
| Effects | Interactive ripples, sparks/light trails, parallax, beat pulse, music ripples, bloom, chromatic aberration and symmetry |
| Widgets | Clock, weather, audio spectrum, CPU/RAM/battery, text and countdown |
| Automation | Playlists, shuffle, time-of-day scenes, night mode, transitions and global hotkeys |
| Displays | Independent, clone and span modes with monitor diagnostics and Windows 11 24H2 WorkerW support |
| Performance | Per-monitor fullscreen pause/mute, battery/idle rules, app blocklist, render-scale and FPS limits |
| Portability | Screenshots, static Windows wallpaper sync, .aquawall import/export and full backup/restore |

Default hotkeys: **Ctrl+Alt+P** pause, **Ctrl+Alt+→/←** next/previous, **Ctrl+Alt+M** mute, **Ctrl+Alt+W** open AquaWall, and **Ctrl+K** command center.

## Website

The public site and browser playground use the same `src/engine` and `src/shared` sources as the desktop app, so the 53 built-in scenes and rendering controls stay synchronized.

- Landing page: `https://itamarbleiberg.github.io/Wallpaper/`
- Browser playground: `https://itamarbleiberg.github.io/Wallpaper/web.html`

A browser cannot attach behind Windows icons or run as a background wallpaper; install the desktop app for Windows integration.

## Architecture

```text
Tauri 2 / Rust                                      React / WebGL2
├─ desktop/win.rs WorkerW/Progman, monitors, power  ├─ Renderer.ts orchestration
├─ wallpaper.rs per-monitor windows                 ├─ WaterSim.ts + PondLife.ts
├─ media.rs yt-dlp + ffmpeg jobs                    ├─ VideoSource.ts / ImageSource.ts
├─ automation.rs schedules and playlists            ├─ ShaderSource.ts + 38 shaders
├─ hotkeys.rs global shortcuts                      ├─ PostFX.ts grading, LUTs and geometry
├─ perf.rs pause/mute/dim watchdog                  └─ TrailFX.ts particles and light trails
└─ protocol.rs range-streamed local media
```

## Build from source on Windows

Prerequisites: Rust, Node.js 20+, Visual Studio Build Tools with Desktop development with C++, and WebView2.

```powershell
npm install
powershell -ExecutionPolicy Bypass -File scripts/fetch-tools.ps1
npm run tauri dev
npm run tauri build
```

Installers are written to `src-tauri/target/release/bundle/{nsis,msi}`. Only download videos you have the right to use.
