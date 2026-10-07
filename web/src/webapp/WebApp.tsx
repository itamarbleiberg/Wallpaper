import { useEffect, useMemo, useRef, useState } from "react";
import { builtinPresets, makePreset, CATEGORY_LABEL } from "@shared/types";
import type { Category, Preset } from "@shared/types";
import { SHADER_LIBRARY } from "@engine/shaderLibrary";
import { WebPreview } from "../shared/WebPreview";
import { SETUP_EXE, homeHref } from "../shared/site";
import { Logo } from "../site/components";
import { cachedThumb, requestThumb } from "../shared/thumbs";
import { PanelFor } from "./panels";

const CATS: (Category | "all")[] = ["all", "water", "nature", "space", "abstract", "retro", "cozy"];

/** Nature videos stream real 4K footage only in the desktop app. */
function isNatureStub(p: Preset): boolean {
  return p.kind === "video" && !!p.video.sourceUrl && !p.video.path;
}

function GalleryItem({ p, active, onClick }: { p: Preset; active: boolean; onClick: () => void }) {
  const [url, setUrl] = useState<string | undefined>(() => cachedThumb(p));
  useEffect(() => {
    let alive = true;
    requestThumb(p).then((u) => alive && u && setUrl(u));
    return () => { alive = false; };
  }, [p]);
  return (
    <button className={`g-item ${active ? "active" : ""}`} onClick={onClick} title={p.name}>
      {url ? <img src={url} alt={p.name} loading="lazy" /> : <span className={`g-ph kind-${p.kind}`} />}
      <span className="g-name">{p.name}</span>
    </button>
  );
}

export function WebApp() {
  const base = useMemo(() => builtinPresets(), []);
  const [presets, setPresets] = useState<Preset[]>(base);
  const [id, setId] = useState<string>(() => new URLSearchParams(location.search).get("w") || "builtin-pool");
  const [cat, setCat] = useState<Category | "all">("all");
  const [showPanel, setShowPanel] = useState(true);
  const [showGallery, setShowGallery] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const preset = presets.find((p) => p.id === id) ?? presets[0];

  const update = (fn: (p: Preset) => void) => {
    setPresets((list) => list.map((p) => {
      if (p.id !== id) return p;
      const next = structuredClone(p);
      fn(next);
      return next;
    }));
  };

  const resetOne = () => {
    const shipped = base.find((b) => b.id === id);
    if (shipped) setPresets((list) => list.map((p) => (p.id === id ? structuredClone(shipped) : p)));
  };

  const onImport = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const isImg = f.type.startsWith("image/");
    const p = makePreset(isImg ? "image" : "video", f.name.replace(/\.[^.]+$/, "").slice(0, 40) || "My file", { category: "water" });
    if (isImg) { p.image.path = url; p.effects.parallax = 0.3; } else p.video.path = url;
    setPresets((list) => [p, ...list]);
    setId(p.id);
  };

  const newShader = () => {
    const p = makePreset("shader", "My shader", { shader: { builtinId: "plasma", code: SHADER_LIBRARY[2].code, speed: 1, mouse: true } });
    setPresets((list) => [p, ...list]);
    setId(p.id);
  };

  const shown = presets.filter((p) => cat === "all" || p.category === cat || (cat === "water" && (p.kind === "video" || p.kind === "image")));

  // reflect current wallpaper in the URL (shareable)
  useEffect(() => {
    const u = new URL(location.href);
    u.searchParams.set("w", id);
    history.replaceState(null, "", u);
  }, [id]);

  const natureStub = isNatureStub(preset);

  return (
    <div className={`web ${showPanel ? "" : "no-panel"} ${showGallery ? "" : "no-gallery"}`}>
      {natureStub ? (
        <div className="web-stage nature-stub">
          <div className="nature-stub-card">
            <span className="ns-badge">Real 4K Nature</span>
            <h2>{preset.name}</h2>
            <p>{preset.description}</p>
            <p className="ns-note">This wallpaper streams real camera footage, which only the desktop app can download &amp; play behind your icons.</p>
            <a className="web-get" href={SETUP_EXE} download>Get AquaWall to use it</a>
          </div>
        </div>
      ) : (
        <WebPreview preset={preset} interactive className="web-stage" showFps />
      )}

      <header className="web-top">
        <a className="web-brand" href={homeHref}><Logo /> AquaWall <span className="web-tag">Web</span></a>
        <div className="web-top-mid">
          <span className="live-note">Live demo — move &amp; click. This runs in your browser; to make it your desktop, get the app.</span>
        </div>
        <div className="web-top-right">
          <button className="web-icbtn" onClick={() => setShowGallery((s) => !s)} title="Toggle gallery">▤</button>
          <button className="web-icbtn" onClick={() => setShowPanel((s) => !s)} title="Toggle settings">⚙</button>
          <a className="web-get" href={SETUP_EXE} download>Get the app</a>
        </div>
      </header>

      {showGallery && (
        <aside className="web-gallery">
          <div className="web-gallery-head">
            <div className="g-cats">
              {CATS.map((c) => <button key={c} className={cat === c ? "on" : ""} onClick={() => setCat(c)}>{c === "all" ? "All" : CATEGORY_LABEL[c]}</button>)}
            </div>
            <div className="g-add">
              <button onClick={() => fileRef.current?.click()}>＋ Video / image</button>
              <button onClick={newShader}>＋ Shader</button>
            </div>
          </div>
          <div className="g-grid">
            {shown.map((p) => <GalleryItem key={p.id} p={p} active={p.id === id} onClick={() => setId(p.id)} />)}
          </div>
          <input ref={fileRef} type="file" accept="video/*,image/*" hidden onChange={(e) => onImport(e.target.files)} />
        </aside>
      )}

      {showPanel && (
        <aside className="web-panel">
          <div className="web-panel-head">
            <div>
              <h3>{preset.name}</h3>
              <span>{preset.description || `${preset.kind} wallpaper`}</span>
            </div>
            <button className="web-reset" onClick={resetOne} title="Reset this wallpaper">↺</button>
          </div>
          <div className="web-panel-body">
            <PanelFor p={preset} upd={update} />
          </div>
          <div className="web-panel-foot">
            <p>Like it? <a href={SETUP_EXE} download>Download AquaWall</a> to use it as your real desktop — with multi-monitor, widgets, link import and 4K video.</p>
          </div>
        </aside>
      )}

      <div className="web-mobilebar">
        <button onClick={() => { setShowGallery(true); setShowPanel(false); }}>Wallpapers</button>
        <button onClick={() => { setShowPanel(true); setShowGallery(false); }}>Customize</button>
        <a href={SETUP_EXE} download>Get app</a>
      </div>
    </div>
  );
}
