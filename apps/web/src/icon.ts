import { signal } from "@preact/signals";
import { call } from "./api.ts";
import { APP_ICON_LIST } from "./app-icons.ts";

/** Icons in public/icons, generated with this list from assets/icons by scripts/generate-icons.py. */
export const APP_ICONS = APP_ICON_LIST;

export type AppIconId = (typeof APP_ICONS)[number]["id"];

/** Also read by the inline script in index.html, which sets the favicon before first paint. */
const ICON_KEY = "sprue.icon";

/** The desktop shell's platform ("darwin", "win32", "linux"), or null in a browser. */
export function desktopPlatform(): string | null {
  return sessionStorage.getItem("sprue.desktop");
}

export const iconSrc = (id: string) => `/icons/${id}.png`;

function isIcon(value: string | null): value is AppIconId {
  return APP_ICONS.some((icon) => icon.id === value);
}

function read(): AppIconId {
  const value = localStorage.getItem(ICON_KEY);
  return isIcon(value) ? value : "default";
}

function applyFavicon(id: AppIconId): void {
  const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (link) link.href = iconSrc(id);
}

function remember(id: AppIconId): void {
  if (id === "default") localStorage.removeItem(ICON_KEY);
  else localStorage.setItem(ICON_KEY, id);
  appIcon.value = id;
  applyFavicon(id);
}

export const appIcon = signal<AppIconId>(read());

/** Favicon everywhere; on desktop also the Dock / taskbar icon (saved by the app itself). */
export async function setAppIcon(id: AppIconId): Promise<void> {
  const previous = appIcon.value;
  remember(id);
  if (!desktopPlatform()) return;
  try {
    await call("app.setIcon", { icon: id });
  } catch (error) {
    remember(previous);
    throw error;
  }
}

/** The desktop app's saved icon wins over this origin's localStorage. */
export async function syncDesktopIcon(): Promise<void> {
  if (!desktopPlatform()) return;
  const { icon } = await call<{ icon: string }>("app.icon");
  if (isIcon(icon) && icon !== appIcon.value) remember(icon);
}

window.addEventListener("storage", (event) => {
  if (event.key !== ICON_KEY) return;
  const id = read();
  appIcon.value = id;
  applyFavicon(id);
});
