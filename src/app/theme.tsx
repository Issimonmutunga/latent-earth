import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "latent-earth:theme";

/** Colors drawn on canvases (map, scatter) that CSS variables can't reach. */
export const THEME_COLORS: Record<Theme, { neutral: string; accent: string }> = {
  light: { neutral: "#41525a", accent: "#0e7c6b" },
  dark: { neutral: "#c9d2d9", accent: "#4fd1b5" },
};

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage can be unavailable (private mode); fall back to the default.
  }
  return "light";
}

interface ThemeApi {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeApi>({ theme: "light", setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Not persisting is fine.
    }
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeApi {
  return useContext(ThemeContext);
}

export function useThemeColors() {
  return THEME_COLORS[useTheme().theme];
}
