"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { LANDING_THEME_STORAGE_KEY } from "@/lib/landingThemeConstants";

export type LandingTheme = "light" | "dark";

type LandingThemeContextValue = {
  landingTheme: LandingTheme;
  setLandingTheme: (theme: LandingTheme) => void;
  toggleLandingTheme: () => void;
  isLandingDark: boolean;
};

const LandingThemeContext = createContext<LandingThemeContextValue | null>(null);

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

export function LandingThemeProvider({ children }: { children: React.ReactNode }) {
  const [landingTheme, setLandingThemeState] = useState<LandingTheme>(readStoredLandingTheme);

  const setLandingTheme = useCallback((theme: LandingTheme) => {
    setLandingThemeState(theme);
    try {
      window.localStorage.setItem(LANDING_THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLandingTheme = useCallback(() => {
    setLandingThemeState((prev) => {
      const next: LandingTheme = prev === "light" ? "dark" : "light";
      try {
        window.localStorage.setItem(LANDING_THEME_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

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
