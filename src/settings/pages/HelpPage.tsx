import { useEffect, useMemo, useState } from "react";
import { invoke } from "../../shared/ipc";
import { Button, Card, Note } from "../controls";
import { Icon } from "../icons";
import { useStore } from "../store";

const GUIDE = [
  ["1", "Choose a wallpaper", "Open Gallery, search or filter, then double-click a card to apply it."],
  ["2", "Make it yours", "Open Customize. Use Source/Edit, Transform, Color, Effects and Enhance like a pro editor."],
  ["3", "Assign displays", "Open Displays for independent wallpapers, clone mode, or one scene spanning every monitor."],
  ["4", "Protect performance", "Fullscreen games pause automatically. Tune battery, idle and app rules in Performance."],
];

const FAQ = [
  ["Wallpaper is missing on one monitor", "Open Displays → Re-attach now. Then run diagnostics and check every display is listed behind icons."],
  ["Video is black or unsupported", "Most H.264 MP4, VP9 WebM and AV1 files work. Use Bake 4K to convert HEVC/ProRes files."],
  ["A nature wallpaper has not started", "Real nature clips download on first use. Keep AquaWall open until the download bar finishes."],
  ["A game feels slower", "Set Fullscreen app or game to Pause in Performance. A paused wallpaper renders no frames."],
  ["Mouse ripples do not react", "Set React to mouse to Always for interaction behind other windows, or Desktop-only for lower overhead."],
  ["Windows warns about the installer", "AquaWall is not code-signed yet. The source and CI build are public; SmartScreen may show More info → Run anyway."],
];

export function HelpPage() {
  const { config, go, notify } = useStore();
  const [query, setQuery] = useState("");
  const [diag, setDiag] = useState<string[]>([]);
  const [tools, setTools] = useState<{ ffmpeg: string | null; ytdlp: string | null } | null>(null);
  useEffect(() => { invoke<typeof tools>("tool_status").then(setTools).catch(() => undefined); }, []);
  const faq = useMemo(() => {
    const q = query.toLowerCase().trim();
    return q ? FAQ.filter((x) => `${x[0]} ${x[1]}`.toLowerCase().includes(q)) : FAQ;
  }, [query]);
  if (!config) return null;

  return <div className="page help-page">
    <header className="page-head"><div><h1>Help center</h1><p>Quick setup, feature guidance, shortcuts and self-service repair.</p></div><Button icon="search" onClick={() => document.querySelector<HTMLInputElement>(".help-search")?.focus()}>Search help</Button></header>

    <Card title="Quick start" icon="sparkle" subtitle="Get a polished desktop in four steps">
      <div className="guide-grid">{GUIDE.map(([n, title, text]) => <button key={n} onClick={() => go(n === "1" ? "gallery" : n === "2" ? "editor" : n === "3" ? "displays" : "performance")}><i>{n}</i><b>{title}</b><span>{text}</span></button>)}</div>
    </Card>

    <div className="masonry">
      <Card title="System readiness" icon="check">
        <div className="readiness"><span><Icon name="check" size={15} /> Wallpaper engine</span><b className="ok-text">Ready</b></div>
        <div className="readiness"><span><Icon name="video" size={15} /> 4K video tools</span><b className={tools?.ffmpeg ? "ok-text" : "warn-text"}>{tools?.ffmpeg ? "Ready" : "Missing ffmpeg"}</b></div>
        <div className="readiness"><span><Icon name="download" size={15} /> Link & nature downloads</span><b className={tools?.ytdlp ? "ok-text" : "warn-text"}>{tools?.ytdlp ? "Ready" : "Missing yt-dlp"}</b></div>
        <Button small icon="folder" onClick={() => invoke("open_folder", { which: "tools" })}>Open tools folder</Button>
      </Card>

      <Card title="Keyboard shortcuts" icon="keyboard">
        {[ [config.hotkeys.pause, "Pause / resume"], [config.hotkeys.next, "Next wallpaper"], [config.hotkeys.prev, "Previous wallpaper"], [config.hotkeys.mute, "Mute"], [config.hotkeys.settings, "Open AquaWall"], ["Ctrl+K", "Command center"], ["Ctrl+Z / Ctrl+Y", "Undo / redo"] ].map(([key, label]) => <div className="help-key" key={label}><kbd>{key || "Not set"}</kbd><span>{label}</span></div>)}
        <Button small onClick={() => go("automation")}>Change shortcuts</Button>
      </Card>

      <Card title="Repair desktop integration" icon="reset">
        <p className="muted small">Use this if a wallpaper disappears after a Windows or Explorer update.</p>
        <div className="row-actions"><Button kind="primary" icon="reset" onClick={async () => { await invoke("reattach"); notify("Wallpaper windows re-attached"); }}>Re-attach</Button><Button icon="info" onClick={async () => setDiag(await invoke<string[]>("diagnostics"))}>Run diagnostics</Button></div>
        {diag.length > 0 && <pre className="diag">{diag.join("\n")}</pre>}
      </Card>

      <Card title="Editor glossary" icon="edit">
        <dl className="glossary"><dt>Lift</dt><dd>Shadow color and black level.</dd><dt>Gamma</dt><dd>Midtone color and brightness.</dd><dt>Gain</dt><dd>Highlight color and white level.</dd><dt>LUT</dt><dd>A prebuilt creative color look.</dd><dt>Bloom</dt><dd>Soft glow around bright areas.</dd><dt>Chroma key</dt><dd>Removes a selected green/blue background.</dd></dl>
      </Card>
    </div>

    <Card title="Troubleshooting" icon="info">
      <div className="search help-search-wrap"><Icon name="search" size={16} /><input className="help-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search problems and answers…" /></div>
      <div className="help-faq">{faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}{!faq.length && <Note>No help articles match “{query}”. Try a shorter phrase.</Note>}</div>
    </Card>
  </div>;
}
