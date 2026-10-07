const ROWS: { label: string; aqua: string | true; others: string | false }[] = [
  { label: "Price", aqua: "Free forever", others: "Often $4–20 or subscription" },
  { label: "Cursor-reactive water & physics", aqua: true, others: "Rare — mostly static video loops" },
  { label: "Import TikTok / YouTube / Reels links", aqua: true, others: false },
  { label: "Built-in 4K loop maker (trim, upscale)", aqua: true, others: "Separate paid tools" },
  { label: "Live GLSL shader wallpapers", aqua: true, others: "Limited or none" },
  { label: "Try everything in a browser first", aqua: true, others: false },
  { label: "Pauses for games to save GPU", aqua: true, others: "Sometimes" },
  { label: "Ads, accounts or telemetry", aqua: "None", others: "Common" },
  { label: "Multi-monitor (per-screen, span, clone)", aqua: true, others: "Partial" },
  { label: "Open source", aqua: true, others: false },
];

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <span className="yes">✓</span>;
  if (v === false) return <span className="no">✕</span>;
  return <span className="txt">{v}</span>;
}

export function Comparison() {
  return (
    <section className="section why" id="why">
      <div className="section-head">
        <span className="kicker">Why AquaWall</span>
        <h2>More interactive than a video. Cheaper than everything.</h2>
        <p>Most live-wallpaper apps just loop a video behind your icons. AquaWall adds a real-time water &amp; fluid engine your cursor can touch — and it's free.</p>
      </div>
      <div className="compare">
        <div className="compare-head">
          <span />
          <span className="col-aqua"><b>AquaWall</b></span>
          <span className="col-other">Typical paid apps</span>
        </div>
        {ROWS.map((r) => (
          <div className="compare-row" key={r.label}>
            <span className="row-label">{r.label}</span>
            <span className="col-aqua"><Cell v={r.aqua} /></span>
            <span className="col-other"><Cell v={r.others} /></span>
          </div>
        ))}
      </div>
    </section>
  );
}
