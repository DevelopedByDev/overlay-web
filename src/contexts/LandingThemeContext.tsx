"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { LANDING_THEME_STORAGE_KEY } from "@/features/landing/lib/landingThemeConstants";

export type LandingTheme = "light" | "dark";

type LandingThemeContextValue = {
  landingTheme: LandingTheme;
  setLandingTheme: (theme: LandingTheme) => void;
  toggleLandingTheme: () => void;
  isLandingDark: boolean;
};

const LandingThemeContext = createContext<LandingThemeContextValue | null>(null);
const LANDING_THEME_CHANGE_EVENT = "overlay:landing-theme-change";

function readStoredLandingTheme(): LandingTheme {
  if (typeof window === "undefined") return "light";
  try {
    const t = window.localStorage.getItem(LANDING_THEME_STORAGE_KEY);
    if (t === "dark" || t === "light") return t;
  } catch {
    /* ignore */
  }
  return "light";
}

function subscribeToLandingTheme(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleChange = () => {
    callback();
  };

  window.addEventListener("storage", handleChange);
  window.addEventListener(LANDING_THEME_CHANGE_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(LANDING_THEME_CHANGE_EVENT, handleChange);
  };
}

function writeStoredLandingTheme(theme: LandingTheme) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANDING_THEME_STORAGE_KEY, theme);
    window.dispatchEvent(new Event(LANDING_THEME_CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

export function LandingThemeProvider({ children }: { children: React.ReactNode }) {
  const landingTheme = useSyncExternalStore<LandingTheme>(
    subscribeToLandingTheme,
    readStoredLandingTheme,
    () => "light",
  );

  const setLandingTheme = useCallback((theme: LandingTheme) => {
    writeStoredLandingTheme(theme);
  }, []);

  const toggleLandingTheme = useCallback(() => {
    const nextTheme: LandingTheme = landingTheme === "light" ? "dark" : "light";
    writeStoredLandingTheme(nextTheme);
  }, [landingTheme]);

  const value = useMemo<LandingThemeContextValue>(
    () => ({
      landingTheme,
      setLandingTheme,
      toggleLandingTheme,
      isLandingDark: landingTheme === "dark",
    }),
    [landingTheme, setLandingTheme, toggleLandingTheme],
  );

  // Override the app's html-level theme while this provider is mounted.
  // The root layout.tsx inline script + AppSettingsProvider both set
  // document.documentElement.dataset.theme from the app's settings. Since
  // globals.css only defines [data-theme='dark'] (no light override),
  // a div-level attribute cannot win back light mode. We must override
  // the <html> element itself and restore the app's theme on unmount.
  const originalRef = useRef<{ theme: string | undefined; colorScheme: string }>({
    theme: undefined,
    colorScheme: "",
  });
  useEffect(() => {
    const root = document.documentElement;
    originalRef.current = {
      theme: root.dataset.theme,
      colorScheme: root.style.colorScheme,
    };
    root.dataset.theme = landingTheme;
    root.style.colorScheme = landingTheme;

    return () => {
      const { theme, colorScheme } = originalRef.current;
      if (theme !== undefined) {
        root.dataset.theme = theme;
      } else {
        delete root.dataset.theme;
      }
      if (colorScheme) {
        root.style.colorScheme = colorScheme;
      } else {
        root.style.removeProperty("colorScheme");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = landingTheme;
    root.style.colorScheme = landingTheme;
  }, [landingTheme]);

  return (
    <LandingThemeContext.Provider value={value}>
      <div
        suppressHydrationWarning
        data-theme={landingTheme}
        data-landing-theme={landingTheme}
        style={{ colorScheme: landingTheme }}
        className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]"
      >
        {children}
      </div>
    </LandingThemeContext.Provider>
  );
}

export function useLandingTheme(): LandingThemeContextValue {
  const ctx = useContext(LandingThemeContext);
  if (!ctx) {
    throw new Error("useLandingTheme must be used within LandingThemeProvider");
  }
  return ctx;
}

/** For shared components that may render outside marketing (e.g. rare fallbacks). */
export function useLandingThemeOptional(): LandingThemeContextValue | null {
  return useContext(LandingThemeContext);
}
