// Central links and constants for the public site.
export const REPO = "itamarbleiberg/Wallpaper";
export const REPO_URL = `https://github.com/${REPO}`;
export const RELEASE_URL = `${REPO_URL}/releases/latest`;
// Stable "latest build" pre-release the CI publishes.
export const SETUP_EXE = `${REPO_URL}/releases/download/latest-build/AquaWall_2.0.0_x64-setup.exe`;
export const MSI = `${REPO_URL}/releases/download/latest-build/AquaWall_2.0.0_x64_en-US.msi`;
export const RELEASES_PAGE = `${REPO_URL}/releases/tag/latest-build`;
export const VERSION = "2.0.0";

/** base-aware path for links/assets under GitHub Pages subpath. */
const RAW_BASE = ((import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL) || "/";
export const BASE: string = RAW_BASE.replace(/\/$/, "");
export const webHref = `${BASE}/web.html`;
export const homeHref = `${BASE}/`;

export function isWindows(): boolean {
  const ua = navigator.userAgent;
  // navigator.userAgentData is more reliable where available.
  const platform = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform;
  if (platform) return /win/i.test(platform);
  return /Windows|Win64|Win32|WOW64/i.test(ua);
}
