const FEATURES: { icon: string; title: string; body: string }[] = [
  { icon: "code", title: "Pro-grade editor", body: "A Resolve-inspired editor with color wheels, creative LUTs, crop, transform, chroma key, motion keyframes, bloom and lens effects." },
  { icon: "water", title: "Interactive water engine", body: "A real GPU wave simulation. Your cursor leaves ripples, clicks make splashes, and koi fish dart away. Not a video — it reacts to you." },
  { icon: "video", title: "Any video, any link", body: "Drop in MP4/WEBM/MOV, or paste a TikTok, YouTube Shorts or Reels link and AquaWall downloads it for you." },
  { icon: "scissors", title: "Built-in 4K loop maker", body: "Trim the perfect loop, pick seamless/ping-pong/crossfade, then bake it to a smooth 4K MP4 with motion interpolation." },
  { icon: "code", title: "38 live shaders", body: "Aurora, galaxies, neon tunnels, rain on glass and more — written in GLSL and running in real time. Edit the code or write your own." },
  { icon: "widgets", title: "Clock, weather & more", body: "Clock, live weather, audio visualizer, CPU/RAM, countdown and custom text — floating over your wallpaper, behind your icons." },
  { icon: "bolt", title: "Light on your PC", body: "Automatically pauses for fullscreen games, maximized apps, low battery or when you step away. A paused wallpaper uses zero GPU." },
  { icon: "monitor", title: "Every monitor", body: "Independent wallpapers per screen, one image spanning all of them, or the same everywhere. Fixed and reliable on Windows 11 24H2." },
  { icon: "clock", title: "Automation", body: "Rotate a playlist, switch by time of day, dim and warm at night, and control it all with global keyboard shortcuts." },
  { icon: "sparkle", title: "53 built-in scenes", body: "New v4 collections add Hyperspace, Daydream Sky, Crystal Facets, Jelly Drift, six new water worlds and more." },
];

function Glyph({ name }: { name: string }) {
  const P: Record<string, string> = {
    water: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
    video: "M3 6h12v12H3zM15 10l6-3v10l-6-3",
    scissors: "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.5 7.5L20 19M8.5 16.5L20 5",
    code: "M8 8l-5 4 5 4M16 8l5 4-5 4M14 4l-4 16",
    widgets: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
    bolt: "M13 3L5 13h6l-1 8 8-10h-6l1-8z",
    monitor: "M3 4h18v12H3zM8 20h8M12 16v4",
    sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18",
    clock: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  };
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={P[name]} />
    </svg>
  );
}

export function Features() {
  return (
    <section className="section" id="features">
      <div className="section-head">
        <span className="kicker">Features</span>
        <h2>Everything a live wallpaper should do</h2>
        <p>Built as a native Windows app so it can sit behind your icons, hook the desktop and stay fast — not a browser tab pretending to be one.</p>
      </div>
      <div className="feature-grid">
        {FEATURES.map((f) => (
          <div className="feature" key={f.title}>
            <div className="feature-icon"><Glyph name={f.icon} /></div>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
