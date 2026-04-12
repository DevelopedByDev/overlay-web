"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { LANDING_THEME_STORAGE_KEY } from "@/lib/landingThemeConstants";

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

  return (
    <LandingThemeContext.Provider value={value}>
      <div
        suppressHydrationWarning
        data-landing-theme={landingTheme}
        className={
          landingTheme === "dark"
            ? "flex min-h-screen flex-col bg-[#0a0a0a] text-zinc-100"
            : "flex min-h-screen flex-col bg-[#fafafa] text-zinc-950"
        }
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
