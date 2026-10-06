import { useEffect, useState } from "react";
import { invoke, onFileDrop, pickVideoFile } from "../../shared/ipc";
import type { Preset } from "../../shared/types";
import { makePreset } from "../../shared/types";
import { BUILTIN_SHADERS } from "../../engine/builtinShaders";
import { Progress, Section } from "../controls";
import { useStore } from "../store";

const KIND_LABEL: Record<Preset["kind"], string> = { water: "Interactive water", video: "Video", shader: "Shader" };
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|mkv)$/i;

export function LibraryPanel() {
  const { config, selectedId, select, update, applyPreset, addVideo, startJob, jobs, tools, notify, setTab } = useStore();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let un: (() => void) | undefined;
    onFileDrop((paths) => {
      const vids = paths.filter((p) => VIDEO_EXT.test(p));
      vids.forEach((p) => addVideo(p, "file"));
      if (paths.length && !vids.length) notify("Drop .mp4, .webm or .mov files");
    }).then((u) => (un = u));
    return () => un?.();
  }, [addVideo, notify]);

  if (!config) return null;
  const active = new Set([config.display.defaultPresetId, ...Object.values(config.display.assignments)]);

  const importFile = async () => {
    const p = await pickVideoFile();
    if (p) await addVideo(p, "file");
  };

  const importUrl = async () => {
    if (!url.trim()) return;
    setBusy(true);
    try {
      const id = await invoke<string>("import_url", { url: url.trim() });
      const source = url.trim();
      startJob(id, `Download ${source.slice(0, 40)}`, (path) => {
        addVideo(path, "url", undefined, source);
        notify("Video downloaded and added");
      });
      setUrl("");
    } catch (e) {
      notify(String(e));
    } finally {
      setBusy(false);
    }
  };

  const duplicate = (p: Preset) => {
    const copy: Preset = { ...structuredClone(p), id: makePreset(p.kind, "").id, name: `${p.name} copy`, builtin: false };
    update((c) => c.presets.push(copy));
    select(copy.id);
  };

  const remove = (p: Preset) => {
    if (p.builtin) return;
    update((c) => {
      c.presets = c.presets.filter((x) => x.id !== p.id);
      if (c.display.defaultPresetId === p.id) c.display.defaultPresetId = c.presets[0]?.id ?? "builtin-pool";
      for (const [k, v] of Object.entries(c.display.assignments)) if (v === p.id) delete c.display.assignments[k];
    }, true);
    if (selectedId === p.id) select(config.presets[0].id);
  };

  const newShader = () => {
    const p = makePreset("shader", "My shader", { shader: { builtinId: "", code: BUILTIN_SHADERS[2].code, speed: 1, mouse: true } });
    update((c) => c.presets.push(p));
    select(p.id);
    setTab("shader");
  };

  const editTab = (p: Preset) => (p.kind === "water" ? "water" : p.kind === "video" ? "video" : "shader");
  const runningJobs = Object.values(jobs).filter((j) => j.kind === "download" && (j.status === "running" || j.status === "error"));

  return (
    <>
      <Section title="Add wallpaper">
        <div className="actions">
          <button className="btn primary" onClick={importFile}>＋ Import video file</button>
          <button className="btn" onClick={newShader}>＋ New shader</button>
          <span className="dim small">…or drag &amp; drop MP4 / WEBM / MOV files onto this window</span>
        </div>
        <div className="url-row">
          <input
            className="text"
            placeholder="Paste a TikTok, YouTube Shorts, Instagram Reel or direct video URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && importUrl()}
          />
          <button className="btn primary" disabled={busy || !url.trim()} onClick={importUrl}>Download</button>
        </div>
        {!tools?.ytdlp && <div className="warn small">yt-dlp was not found, so URL import is unavailable. Run <code>scripts/fetch-tools.ps1</code> or put yt-dlp.exe in the tools folder.</div>}
        <div className="dim small">Only download videos you have the right to use.</div>
        {runningJobs.map((j) => (
          <div key={j.id} className="job">
            <div className="job-head"><span>{j.label}</span><span className="mono">{j.status === "error" ? "failed" : `${Math.round(j.progress * 100)}%`}</span></div>
            {j.status === "running" ? <Progress value={j.progress} /> : <pre className="error-box">{j.message}</pre>}
            {j.status === "running" && <button className="btn ghost small" onClick={() => invoke("cancel_job", { id: j.id })}>Cancel</button>}
          </div>
        ))}
      </Section>

      <Section title="Wallpapers" right={<button className="btn ghost small" onClick={() => invoke("open_folder", { which: "library" })}>Open library folder</button>}>
        <div className="grid">
          {config.presets.map((p) => (
            <div key={p.id} className={`tile ${p.id === selectedId ? "selected" : ""}`} onClick={() => select(p.id)}>
              <div className={`tile-art kind-${p.kind}`}>
                {active.has(p.id) && <span className="badge">Active</span>}
                <span className="tile-kind">{KIND_LABEL[p.kind]}</span>
              </div>
              <div className="tile-name">{p.name}</div>
              <div className="tile-actions" onClick={(e) => e.stopPropagation()}>
                <button className="btn small primary" onClick={() => applyPreset(p.id)}>Apply</button>
                <button className="btn small ghost" onClick={() => { select(p.id); setTab(editTab(p)); }}>Edit</button>
                <button className="btn small ghost" onClick={() => duplicate(p)}>Duplicate</button>
                {!p.builtin && <button className="btn small ghost danger" onClick={() => remove(p)}>Delete</button>}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
