import { useState, type ReactNode } from "react";
import { webHref } from "../shared/site";

const QA: { q: string; a: ReactNode }[] = [
  { q: "Is it really free?", a: "Yes. No price, no subscription, no ads, no account. It's open source." },
  { q: "Which Windows versions are supported?", a: "Windows 10 and 11, including the 11 24H2 update where many wallpaper apps break on multi-monitor setups. AquaWall handles that layout." },
  { q: "Do I need to install anything to try it?", a: <>No. The <a href={webHref}>web playground</a> runs the exact same engine in your browser so you can try every wallpaper and setting. To actually set it as your desktop, you install the small app.</> },
  { q: "Why can't the website itself be my wallpaper?", a: "Browsers are sandboxed and can't draw behind desktop icons, set your wallpaper or run in the background — that needs a real app. The browser version is a full live demo, not a desktop replacement." },
  { q: "Will it slow down my PC or games?", a: "It renders on the GPU and automatically pauses for fullscreen games, maximized apps, low battery, or when you're away. A paused wallpaper uses no GPU at all." },
  { q: "Is the installer safe? Windows warned me.", a: "The installer isn't code-signed yet, so SmartScreen shows a warning. Click \u201cMore info \u2192 Run anyway\u201d. The source is public if you'd like to review or build it yourself." },
  { q: "What happens when I uninstall?", a: "Your previous Windows wallpaper comes straight back. AquaWall doesn't change system files." },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="section faq" id="faq">
      <div className="section-head">
        <span className="kicker">FAQ</span>
        <h2>Good questions</h2>
      </div>
      <div className="faq-list">
        {QA.map((item, i) => (
          <div className={`faq-item ${open === i ? "open" : ""}`} key={i}>
            <button onClick={() => setOpen(open === i ? null : i)}>
              <span>{item.q}</span>
              <span className="faq-chev">⌄</span>
            </button>
            <div className="faq-a"><div>{item.a}</div></div>
          </div>
        ))}
      </div>
    </section>
  );
}
