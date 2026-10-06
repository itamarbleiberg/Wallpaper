// Minimal inline SVG icon set (24x24, stroke-based).
const P: Record<string, string> = {
  gallery: "M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z",
  edit: "M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4",
  widgets: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  automation: "M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4",
  displays: "M3 5h12v9H3zM7 18h4M9 14v4M17 8h4v9h-4",
  performance: "M13 3L5 13h6l-1 8 8-10h-6l1-8z",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  play: "M7 4l13 8-13 8z",
  pause: "M7 4h4v16H7zM14 4h4v16h-4z",
  next: "M5 4l10 8-10 8zM17 4h2v16h-2z",
  prev: "M19 4L9 12l10 8zM5 4h2v16H5z",
  shuffle: "M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  plus: "M12 5v14M5 12h14",
  video: "M3 6h12v12H3zM15 10l6-3v10l-6-3",
  image: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5h.01",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  code: "M8 8l-5 4 5 4M16 8l5 4-5 4M14 4l-4 16",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
  monitor: "M3 4h18v12H3zM8 20h8M12 16v4",
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  redo: "M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
  reset: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
  copy: "M8 8h12v12H8zM4 16V4h12",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  download: "M12 4v12M7 11l5 5 5-5M4 20h16",
  folder: "M3 6h6l2 2h10v11H3z",
  volume: "M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6",
  mute: "M4 9h4l5-4v14l-5-4H4zM17 9l4 6M21 9l-4 6",
  check: "M5 12l5 5 9-10",
  x: "M6 6l12 12M18 6L6 18",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18",
  water: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
  info: "M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  keyboard: "M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8",
};

export function Icon({ name, size = 18, filled = false, className = "" }: { name: keyof typeof P | string; size?: number; filled?: boolean; className?: string }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={P[name] ?? P.info} />
    </svg>
  );
}
