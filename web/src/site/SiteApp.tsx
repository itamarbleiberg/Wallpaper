import { useEffect, useMemo, useState } from "react";
import { builtinPresets } from "@shared/types";
import type { Preset } from "@shared/types";
import { WebPreview } from "../shared/WebPreview";
import { RELEASES_PAGE, SETUP_EXE, VERSION, isWindows, webHref } from "../shared/site";
import { DownloadButton, Logo, Stat } from "./components";
import { Comparison } from "./Comparison";
import { Features } from "./Features";
import { GalleryStrip } from "./GalleryStrip";
import { Faq } from "./Faq";

const HERO_IDS = ["builtin-pool", "builtin-koi", "builtin-shader-ocean-sunset", "builtin-shader-aurora", "builtin-shader-retro-sun", "builtin-night-pool"];

export function SiteApp() {
  const presets = useMemo(() => builtinPresets(), []);
  const heroSet = useMemo(() => HERO_IDS.map((id) => presets.find((p) => p.id === id)).filter(Boolean) as Preset[], [presets]);
  const [heroIdx, setHeroIdx] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const win = useMemo(isWindows, []);

  useEffect(() => {
    const id = setInterval(() => setHeroIdx((i) => (i + 1) % heroSet.length), 7000);
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearInterval(id);
      window.removeEventListener("scroll", onScroll);
    };
  }, [heroSet.length]);

  const hero = heroSet[heroIdx] ?? presets[0];

  return (
    <div className="site">
      <header className={`nav ${scrolled ? "solid" : ""}`}>
        <a className="nav-brand" href="#top"><Logo /> AquaWall</a>
        <nav className="nav-links">
          <a href="#why">Why AquaWall</a>
          <a href="#features">Features</a>
          <a href="#gallery">Wallpapers</a>
          <a href="#faq">FAQ</a>
          <a className="nav-try" href={webHref}>Try in browser</a>
          <DownloadButton small />
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-bg">
          <WebPreview preset={hero} interactive autoDemo className="hero-canvas" />
          <div className="hero-scrim" />
        </div>
        <div className="hero-content">
          <span className="badge"><span className="pulse" /> Free · Windows 10 & 11 · v{VERSION}</span>
          <h1>Your desktop,<br /><span className="grad">alive and interactive.</span></h1>
          <p className="lede">
            AquaWall replaces your static wallpaper with water that ripples under your cursor, koi that swim away from your mouse,
            looping videos, and 33 hand-built scenes — all running behind your desktop icons.
          </p>
          <div className="hero-cta">
            <DownloadButton large />
            <a className="btn ghost large" href={webHref}>▶ Try it live — no download</a>
          </div>
          <p className="hero-sub">
            {win ? "Looks like you're on Windows — you're good to go." : "Note: the app runs on Windows. You can still try everything in your browser."}
            {" "}Move your mouse over the preview above.
          </p>
          <div className="hero-stats">
            <Stat n="33" label="built-in wallpapers" />
            <Stat n="60fps" label="4K rendering" />
            <Stat n="0" label="cost, forever" />
          </div>
        </div>
        <button className="hero-switch" onClick={() => setHeroIdx((i) => (i + 1) % heroSet.length)} title="Next wallpaper">
          {heroSet.map((_, i) => <span key={i} className={i === heroIdx ? "on" : ""} />)}
        </button>
      </section>

      <section className="trust">
        <p>Interactive water & fluid simulation · Video &amp; link import · Shaders · Multi-monitor · System tray · Low GPU usage</p>
      </section>

      <Comparison />
      <Features />
      <GalleryStrip presets={presets} />

      <section className="cta-band">
        <h2>Make your desktop yours.</h2>
        <p>Install in seconds. No account, no ads, no telemetry. Uninstall any time and your old wallpaper comes right back.</p>
        <div className="hero-cta center">
          <DownloadButton large />
          <a className="btn ghost large" href={webHref}>Try in browser first</a>
        </div>
        <a className="releases-link" href={RELEASES_PAGE} target="_blank" rel="noreferrer">All downloads &amp; release notes →</a>
      </section>

      <Faq />

      <footer className="footer">
        <div className="footer-main">
          <div><Logo /> <b>AquaWall</b></div>
          <p>Interactive live wallpapers for Windows. Free &amp; open.</p>
        </div>
        <div className="footer-links">
          <a href={SETUP_EXE}>Download</a>
          <a href={webHref}>Web playground</a>
          <a href={RELEASES_PAGE} target="_blank" rel="noreferrer">Releases</a>
          <a href={`https://github.com/itamarbleiberg/Wallpaper`} target="_blank" rel="noreferrer">Source</a>
        </div>
        <p className="footer-fine">Not affiliated with Microsoft. Only download videos you have the right to use.</p>
      </footer>
    </div>
  );
}
