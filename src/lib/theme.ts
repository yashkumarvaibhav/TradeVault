export type Theme = "light" | "dark";

const STORAGE_KEY = "tv-theme";

/** Resolve the effective theme: explicit `data-theme`, else the OS preference. */
export function readTheme(): Theme {
  if (typeof document !== "undefined") {
    const explicit = document.documentElement.getAttribute("data-theme");
    if (explicit === "light" || explicit === "dark") return explicit;
  }
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

/** Apply a theme to the document and persist it (best-effort). */
export function applyTheme(theme: Theme): Theme {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode / disabled storage: the in-DOM attribute still applies for this session.
  }
  return theme;
}

/** Flip light↔dark and return the newly applied theme. */
export function toggleTheme(): Theme {
  return applyTheme(readTheme() === "dark" ? "light" : "dark");
}
