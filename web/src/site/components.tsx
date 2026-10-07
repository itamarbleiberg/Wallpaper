import { SETUP_EXE } from "../shared/site";

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="logo-mark" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="currentColor" aria-hidden>
        <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
      </svg>
    </span>
  );
}

export function DownloadButton({ large, small }: { large?: boolean; small?: boolean }) {
  return (
    <a className={`btn primary ${large ? "large" : ""} ${small ? "small" : ""}`} href={SETUP_EXE} download>
      <svg viewBox="0 0 24 24" width={small ? 15 : 18} height={small ? 15 : 18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
      </svg>
      {small ? "Download" : "Download for Windows"}
    </a>
  );
}

export function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="stat">
      <b>{n}</b>
      <span>{label}</span>
    </div>
  );
}
