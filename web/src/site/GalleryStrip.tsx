import { useEffect, useState } from "react";
import type { Preset } from "@shared/types";
import { cachedThumb, requestThumb } from "../shared/thumbs";
import { webHref } from "../shared/site";

function Card({ p }: { p: Preset }) {
  const [url, setUrl] = useState<string | undefined>(() => cachedThumb(p));
  useEffect(() => {
    let alive = true;
    requestThumb(p).then((u) => alive && u && setUrl(u));
    return () => { alive = false; };
  }, [p]);
  return (
    <a className="strip-card" href={`${webHref}?w=${p.id}`} title={`Try ${p.name}`}>
      {url ? <img src={url} alt={p.name} loading="lazy" /> : <div className={`strip-ph kind-${p.kind}`} />}
      <span className="strip-name">{p.name}</span>
    </a>
  );
}

export function GalleryStrip({ presets }: { presets: Preset[] }) {
  // A representative spread across categories.
  const ids = [
    "builtin-pool", "builtin-koi", "builtin-shader-aurora", "builtin-shader-ocean-sunset",
    "builtin-shader-galaxy", "builtin-shader-neon-tunnel", "builtin-shader-sakura", "builtin-mosaic-spa",
    "builtin-shader-rain-glass", "builtin-shader-retro-sun", "builtin-shader-firefly", "builtin-night-pool",
  ];
  const show = ids.map((id) => presets.find((p) => p.id === id)).filter(Boolean) as Preset[];

  return (
    <section className="section" id="gallery">
      <div className="section-head">
        <span className="kicker">Wallpapers</span>
        <h2>33 scenes in the box — all interactive</h2>
        <p>Water pools, koi ponds, galaxies, synthwave sunsets, falling sakura and more. Click any one to try it live in your browser.</p>
      </div>
      <div className="strip">
        {show.map((p) => <Card key={p.id} p={p} />)}
      </div>
      <div className="strip-cta">
        <a className="btn ghost" href={webHref}>Open the full browser playground →</a>
      </div>
    </section>
  );
}
