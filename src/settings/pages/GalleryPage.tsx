import { useEffect, useMemo, useState } from "react";
import { invoke, importText, onFileDrop, pickImageFile, pickVideoFile } from "../../shared/ipc";
import type { Category, Preset } from "../../shared/types";
import { CATEGORY_LABEL, makePreset } from "../../shared/types";
import { SHADER_LIBRARY } from "../../engine/shaderLibrary";
import { Button, Modal, Note, Progress, TextInput } from "../controls";
import { Icon } from "../icons";
import { Preview } from "../Preview";
import { useStore } from "../store";
import { cachedThumb, requestThumb } from "../thumbs";

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|mkv)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|bmp|gif)$/i;
const KIND_ICON: Record<Preset["kind"], string> = { water: "water", video: "video", image: "image", shader: "code" };
const CATS: (Category | "all" | "favorites")[] = ["all", "favorites", "water", "nature", "space", "abstract", "retro", "cozy", "mine"];

export function Thumb({ preset }: { preset: Preset }) {
  const [url, setUrl] = useState<string | undefined>(() => cachedThumb(preset));
  useEffect(() => {
    let alive = true;
    const c = cachedThumb(preset);
    if (c) setUrl(c);
    else requestThumb(preset).then((u) => alive && u && setUrl(u));
    return () => { alive = false; };
  }, [preset]);
  return url ? <img className="thumb-img" src={url} alt="" draggable={false} /> : <div className={`thumb-img placeholder kind-${preset.kind}`}><Icon name={KIND_ICON[preset.kind]} size={28} /></div>;
}

function WallpaperCard({ p, active }: { p: Preset; active: boolean }) {
  const { applyPreset, edit, toggleFavorite, duplicate, remove, config } = useStore();
  const sync = config?.general.syncStaticWallpaper;
  return (
    <div className={`wcard ${active ? "active" : ""}`} onDoubleClick={() => applyPreset(p.id)}>
      <div className="wcard-media">
        <Thumb preset={p} />
        <button className={`fav ${p.favorite ? "on" : ""}`} onClick={() => toggleFavorite(p.id)} title={p.favorite ? "Remove from favorites" : "Add to favorites"}>
          <Icon name="star" size={16} filled={p.favorite} />
        </button>
        {active && <span className="live-badge"><span className="dot on" /> On desktop</span>}
        <div className="wcard-hover">
          <Button kind="primary" icon="check" onClick={() => applyPreset(p.id)}>{active ? "Applied" : "Apply"}</Button>
          <Button icon="edit" onClick={() => edit(p.id)}>Customize</Button>
        </div>
      </div>
      <div className="wcard-info">
        <div className="wcard-title">
          <Icon name={KIND_ICON[p.kind]} size={14} />
          <b>{p.name}</b>
        </div>
        <p>{p.description || (p.kind === "video" ? "Video wallpaper" : p.kind === "image" ? "Image wallpaper" : "Custom wallpaper")}</p>
        <div className="wcard-actions">
          <button onClick={() => duplicate(p.id)} title="Duplicate"><Icon name="copy" size={14} /></button>
          {!p.builtin && <button onClick={() => remove(p.id)} title="Delete"><Icon name="trash" size={14} /></button>}
          {sync && active && <span className="tiny">synced to Windows</span>}
        </div>
      </div>
    </div>
  );
}

function UrlDialog({ onClose }: { onClose: () => void }) {
  const { startJob, addMedia, notify, tools } = useStore();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    const u = url.trim();
    if (!u) return;
    setBusy(true);
    try {
      const id = await invoke<string>("import_url", { url: u });
      startJob(id, `Download ${u.replace(/^https?:\/\//, "").slice(0, 36)}`, (path) => {
        addMedia(path, "video", "url", undefined, u);
        notify("Video downloaded and added to your wallpapers");
      });
      notify("Download started");
      onClose();
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Import from a link" onClose={onClose} footer={<><Button kind="ghost" onClick={onClose}>Cancel</Button><Button kind="primary" icon="download" disabled={busy || !url.trim() || !tools?.ytdlp} onClick={go}>Download</Button></>}>
      <p className="muted">Paste a TikTok, YouTube Shorts, Instagram Reel, Vimeo or direct .mp4 link. The best quality up to 4K is downloaded.</p>
      <TextInput value={url} onChange={setUrl} onEnter={go} placeholder="https://…" />
      {!tools?.ytdlp && <Note kind="warn">yt-dlp wasn't found. Reinstall AquaWall, or put <code>yt-dlp.exe</code> in the tools folder (Settings → Tools).</Note>}
      <p className="tiny muted">Only download videos you have the right to use.</p>
    </Modal>
  );
}

export function GalleryPage() {
  const { config, search, setSearch, category, setCategory, addMedia, createPreset, edit, notify, jobs, update } = useStore();
  const [urlOpen, setUrlOpen] = useState(false);

  useEffect(() => {
    let un: (() => void) | undefined;
    onFileDrop((paths) => {
      let n = 0;
      for (const p of paths) {
        if (VIDEO_EXT.test(p)) { addMedia(p, "video", "file"); n++; }
        else if (IMAGE_EXT.test(p)) { addMedia(p, "image", "image"); n++; }
      }
      if (paths.length && !n) notify("Drop video (MP4/WEBM/MOV) or image (JPG/PNG/WEBP) files", "error");
    }).then((u) => (un = u));
    return () => un?.();
  }, [addMedia, notify]);

  const list = useMemo(() => {
    if (!config) return [];
    const q = search.trim().toLowerCase();
    return config.presets.filter((p) => {
      if (category === "favorites" && !p.favorite) return false;
      if (category !== "all" && category !== "favorites" && p.category !== category) return false;
      if (q && !(`${p.name} ${p.description} ${p.category} ${p.kind}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [config, search, category]);

  if (!config) return null;
  const active = config.presets.find((p) => p.id === config.display.defaultPresetId) ?? config.presets[0];
  const onDesktop = new Set([config.display.defaultPresetId, ...Object.values(config.display.assignments)]);
  const downloads = Object.values(jobs).filter((j) => j.kind === "download" && j.status === "running");

  const importPresetFile = async () => {
    try {
      const text = await importText(["aquawall", "json"]);
      if (!text) return;
      const data = JSON.parse(text);
      const incoming: Preset[] = Array.isArray(data?.presets) ? data.presets : data?.kind ? [data] : [];
      if (!incoming.length) throw new Error("No wallpapers found in this file");
      await update((c) => {
        for (const raw of incoming) {
          const p = makePreset(raw.kind ?? "shader", raw.name ?? "Imported", { ...raw, builtin: false, category: "mine" });
          p.id = makePreset(p.kind, "").id;
          c.presets.push(p);
        }
      }, { immediate: true });
      notify(`Imported ${incoming.length} wallpaper${incoming.length > 1 ? "s" : ""}`);
      setCategory("mine");
    } catch (e) {
      notify(`Import failed: ${(e as Error).message ?? e}`, "error");
    }
  };

  return (
    <div className="page gallery">
      <section className="hero">
        <div className="hero-preview"><Preview preset={active} badge={false} /></div>
        <div className="hero-info">
          <span className="eyebrow"><span className="dot on" /> Now on your desktop</span>
          <h1>{active.name}</h1>
          <p>{active.description || "Your custom wallpaper."}</p>
          <div className="hero-actions">
            <Button kind="primary" icon="edit" onClick={() => edit(active.id)}>Customize</Button>
            <Button icon="next" onClick={() => invoke("step_wallpaper", { dir: 1 })}>Next</Button>
            <Button icon="shuffle" onClick={() => invoke("step_wallpaper", { dir: 0 })}>Surprise me</Button>
          </div>
          <p className="tiny muted">Move the mouse over the preview to try it out. Double-click a card to apply it.</p>
        </div>
      </section>

      <section className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${config.presets.length} wallpapers…`} />
          {search && <button onClick={() => setSearch("")}><Icon name="x" size={14} /></button>}
        </div>
        <div className="add-buttons">
          <Button icon="video" onClick={async () => { const p = await pickVideoFile(); if (p) addMedia(p, "video", "file"); }}>Video</Button>
          <Button icon="image" onClick={async () => { const p = await pickImageFile(); if (p) addMedia(p, "image", "image"); }}>Image</Button>
          <Button icon="link" onClick={() => setUrlOpen(true)}>From link</Button>
          <Button icon="code" onClick={() => { const p = createPreset("shader", "My shader", { shader: { builtinId: "", code: SHADER_LIBRARY[2].code, speed: 1, mouse: true } }); edit(p.id, "code"); }}>Shader</Button>
          <Button icon="upload" kind="ghost" onClick={importPresetFile} title="Import .aquawall file">Import</Button>
        </div>
      </section>

      <div className="chips">
        {CATS.map((c) => {
          const n = c === "all" ? config.presets.length : c === "favorites" ? config.presets.filter((p) => p.favorite).length : config.presets.filter((p) => p.category === c).length;
          if (c === "mine" && n === 0) return null;
          return (
            <button key={c} className={`chip ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>
              {c === "favorites" && <Icon name="star" size={12} filled />}
              {c === "all" ? "All" : c === "favorites" ? "Favorites" : CATEGORY_LABEL[c]}
              <span className="count">{n}</span>
            </button>
          );
        })}
      </div>

      {downloads.map((j) => (
        <div key={j.id} className="job-bar">
          <Icon name="download" size={16} />
          <span>{j.label}</span>
          <Progress value={j.progress} />
          <span className="mono">{Math.round(j.progress * 100)}%</span>
          <Button small kind="ghost" onClick={() => invoke("cancel_job", { id: j.id })}>Cancel</Button>
        </div>
      ))}

      {list.length === 0 ? (
        <div className="empty">
          <Icon name={category === "favorites" ? "star" : "search"} size={32} />
          <p>{category === "favorites" ? "No favorites yet. Click the ☆ on any wallpaper." : "No wallpapers match your search."}</p>
        </div>
      ) : (
        <div className="wgrid">
          {list.map((p) => <WallpaperCard key={p.id} p={p} active={onDesktop.has(p.id)} />)}
        </div>
      )}

      <div className="drop-hint"><Icon name="upload" size={16} /> Drag & drop videos or images anywhere in this window to turn them into wallpapers.</div>
      {urlOpen && <UrlDialog onClose={() => setUrlOpen(false)} />}
    </div>
  );
}
