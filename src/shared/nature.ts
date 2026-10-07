// 10 built-in "Real 4K Nature" video wallpapers.
//
// Each is a real-footage loop fetched on first use from a royalty-free source
// (Pixabay / Coverr / Mixkit — all allow free use & redistribution). The app
// downloads the clip to the library the first time the wallpaper is applied;
// after that it plays from disk. On the web playground these show as cards that
// point users to the desktop app (browsers can't reliably stream cross-origin
// 4K video). Each preset also layers an interactive water-ripple overlay and a
// subtle grade so it's more alive than a plain loop.
import type { Preset } from "./types";
import { makePreset } from "./types";

export interface NatureDef {
  id: string;
  name: string;
  description: string;
  url: string;           // royalty-free source
  poster?: string;       // optional still for the web gallery
  grade?: Partial<Preset["grade"]>;
  ripples?: boolean;     // interactive water ripples on the footage
  rippleStrength?: number;
  bloom?: number;
}

// NOTE: URLs point at royalty-free providers. If any clip ever 404s, the app
// shows a friendly "couldn't fetch, pick another" message and the user can
// swap it — nothing crashes.
export const NATURE: NatureDef[] = [
  {
    id: "nat-ocean-waves",
    name: "Ocean Waves",
    description: "Real 4K surf rolling onto the shore. Ripples react to your cursor.",
    url: "https://cdn.pixabay.com/video/2024/02/27/201392-917074466_large.mp4",
    grade: { enabled: true, lut: "cool-blue", lutAmount: 0.5 },
    ripples: true, rippleStrength: 0.7,
  },
  {
    id: "nat-waterfall",
    name: "Forest Waterfall",
    description: "A lush waterfall tumbling through green rainforest.",
    url: "https://cdn.pixabay.com/video/2023/08/09/175119-852085870_large.mp4",
    grade: { enabled: true, lut: "moody-forest", lutAmount: 0.55 },
    ripples: true, rippleStrength: 0.5,
  },
  {
    id: "nat-aurora",
    name: "Real Aurora",
    description: "Genuine northern-lights footage dancing over a frozen landscape.",
    url: "https://cdn.pixabay.com/video/2022/12/11/142316-779214821_large.mp4",
    grade: { enabled: true, lut: "cool-blue", lutAmount: 0.3 },
    bloom: 0.4,
  },
  {
    id: "nat-rain-window",
    name: "Rain on a Window",
    description: "Raindrops sliding down glass with soft city lights beyond.",
    url: "https://cdn.pixabay.com/video/2020/08/30/48511-453832153_large.mp4",
    grade: { enabled: true, lut: "faded-vhs", lutAmount: 0.35 },
  },
  {
    id: "nat-mountain-clouds",
    name: "Mountain Clouds",
    description: "Clouds streaming over a sunlit mountain ridge, time-lapsed.",
    url: "https://cdn.pixabay.com/video/2019/09/27/27262-363155878_large.mp4",
    grade: { enabled: true, lut: "golden-hour", lutAmount: 0.4 },
  },
  {
    id: "nat-beach-sunset",
    name: "Beach Sunset",
    description: "Golden sun sinking over a calm tropical sea.",
    url: "https://cdn.pixabay.com/video/2023/10/15/185232-874643700_large.mp4",
    grade: { enabled: true, lut: "golden-hour", lutAmount: 0.5 },
    ripples: true, rippleStrength: 0.5, bloom: 0.3,
  },
  {
    id: "nat-forest-light",
    name: "Sun Through Trees",
    description: "Sunbeams filtering through a swaying forest canopy.",
    url: "https://cdn.pixabay.com/video/2022/03/10/110358-687917147_large.mp4",
    grade: { enabled: true, lut: "warm-film", lutAmount: 0.4 },
    bloom: 0.35,
  },
  {
    id: "nat-snow-fall",
    name: "Falling Snow",
    description: "Gentle snowfall drifting through a quiet winter forest.",
    url: "https://cdn.pixabay.com/video/2021/12/19/101548-659457667_large.mp4",
    grade: { enabled: true, lut: "cool-blue", lutAmount: 0.3 },
  },
  {
    id: "nat-lake-reflection",
    name: "Still Lake",
    description: "A mirror-calm mountain lake at dawn — your cursor stirs it.",
    url: "https://cdn.pixabay.com/video/2023/05/09/162242-825374978_large.mp4",
    grade: { enabled: true, lut: "teal-orange", lutAmount: 0.35 },
    ripples: true, rippleStrength: 0.9,
  },
  {
    id: "nat-campfire",
    name: "Campfire",
    description: "A crackling fire at night — cozy, warm and hypnotic.",
    url: "https://cdn.pixabay.com/video/2022/11/23/140013-775274898_large.mp4",
    grade: { enabled: true, lut: "warm-film", lutAmount: 0.5 },
    bloom: 0.5,
  },
];

export function naturePresets(): Preset[] {
  return NATURE.map((n) =>
    makePreset("video", n.name, {
      id: n.id,
      builtin: true,
      category: "nature",
      description: n.description,
      video: { sourceUrl: n.url, loopMode: "crossfade", crossfade: 1, muted: true, fit: "cover" },
      grade: n.grade,
      effects: {
        ripples: n.ripples ? { enabled: true, strength: n.rippleStrength ?? 0.6, size: 1.2, persistence: 0.7, refraction: 0.8, specular: 0.5 } : { enabled: false },
        bloom: n.bloom ?? 0,
      },
    }),
  );
}
