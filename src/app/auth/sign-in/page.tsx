"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageNavbar } from "@/components/PageNavbar";
import { LandingThemeProvider, useLandingTheme } from "@/contexts/LandingThemeContext";
import {
  marketingAuthCard,
  marketingAuthMuted,
  marketingDividerLabel,
  marketingPrimaryField,
  marketingSsoButton,
  marketingSubmitButton,
} from "@/lib/landingPageStyles";

function SignInContent() {
  const { isLandingDark } = useLandingTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [sessionCleared, setSessionCleared] = useState(false);
  const [clearingSession, setClearingSession] = useState(false);

  const redirectUrl = searchParams?.get("redirect") || "/account";
  const forceLogin = searchParams?.get("force") === "true";
  const isDesktopAuth = redirectUrl.startsWith("overlay://");
  const desktopAuthFlow =
    forceLogin || redirectUrl.includes("desktop_code_challenge=");

  useEffect(() => {
    const errorParam = searchParams?.get("error");
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  useEffect(() => {
    if ((isDesktopAuth || forceLogin) && !sessionCleared && !clearingSession) {
      setClearingSession(true);
      const signOutExisting = async () => {
        try {
          await fetch("/api/auth/sign-out", { method: "POST" });
        } catch (e) {
          console.error("[SignIn] Failed to clear session:", e);
        } finally {
          setSessionCleared(true);
          setClearingSession(false);
        }
      };
      void signOutExisting();
    }
  }, [isDesktopAuth, forceLogin, sessionCleared, clearingSession]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPendingVerification(false);

    try {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.pendingEmailVerification) {
        setPendingVerification(true);
        setError(data.error);
        return;
      }

      if (!response.ok) {
        setError(data.error || "Sign in failed");
        return;
      }

      if (redirectUrl.startsWith("overlay://")) {
        window.location.href = redirectUrl;
      } else {
        router.push(redirectUrl);
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSSO = (provider: "google" | "apple" | "microsoft") => {
    setSsoLoading(provider);
    const forceParam = isDesktopAuth || forceLogin ? "&force=true" : "";
    const ssoUrl = `/api/auth/sso/${provider}?redirect=${encodeURIComponent(redirectUrl)}${forceParam}`;
    window.location.href = ssoUrl;
  };

  const card = desktopAuthFlow
    ? isLandingDark
      ? "mx-auto w-full max-w-md rounded-[28px] border border-zinc-800 bg-zinc-950/92 p-8 shadow-[0_28px_120px_rgba(0,0,0,0.35)] backdrop-blur"
      : "mx-auto w-full max-w-md rounded-[28px] border border-zinc-200 bg-white/96 p-8 shadow-[0_28px_120px_rgba(15,23,42,0.12)] backdrop-blur"
    : marketingAuthCard(isLandingDark);
  const muted = desktopAuthFlow
    ? isLandingDark
      ? "text-zinc-400"
      : "text-zinc-500"
    : marketingAuthMuted(isLandingDark);
  const sso = marketingSsoButton(isLandingDark);
  const field = marketingPrimaryField(isLandingDark);
  const submit = marketingSubmitButton(isLandingDark);
  const divLabel = marketingDividerLabel(isLandingDark);
  const labelText = isLandingDark ? "text-zinc-300" : "text-zinc-900";
  const linkMuted = isLandingDark ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-500 hover:text-zinc-900";
  const createLink = isLandingDark ? "text-zinc-100 hover:underline font-medium" : "text-zinc-900 hover:underline font-medium";
  const shellClass = desktopAuthFlow
    ? isLandingDark
      ? "flex min-h-screen w-full flex-col bg-[linear-gradient(180deg,#0b0b0d_0%,#101013_100%)]"
      : "flex min-h-screen w-full flex-col bg-[linear-gradient(180deg,#fafafa_0%,#f4f4f5_100%)]"
    : isLandingDark
      ? "flex min-h-screen w-full flex-col bg-[radial-gradient(circle_at_top,_rgba(120,119,198,0.16),_transparent_32%),linear-gradient(180deg,#0b0b0d_0%,#121215_56%,#0a0a0c_100%)]"
      : "flex min-h-screen w-full flex-col bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.06),_transparent_28%),linear-gradient(180deg,#fcfcfd_0%,#f5f5f7_56%,#efeff2_100%)]";
  const ambientClass = desktopAuthFlow
    ? isLandingDark
      ? "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.04),transparent_22%)]"
      : "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.85),transparent_20%)]"
    : isLandingDark
      ? "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.06),transparent_22%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.12),transparent_26%)]"
      : "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.92),transparent_18%),radial-gradient(circle_at_82%_4%,rgba(148,163,184,0.14),transparent_24%)]";

  return (
    <div className={shellClass}>
      <div className={ambientClass} />

      <PageNavbar />

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className={card}>
            <h1 className={`text-2xl font-serif text-center mb-2 ${labelText}`}>Welcome back</h1>
            <p className={`text-sm text-center mb-8 ${muted}`}>Sign in to your overlay account</p>

            {error && (
              <div
                className={
                  isLandingDark
                    ? "mb-6 p-4 rounded-xl bg-red-950/50 border border-red-800/80 text-red-200 text-sm"
                    : "mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm"
                }
              >
                {error}
                {pendingVerification && (
                  <Link
                    href={`/auth/verify-email?email=${encodeURIComponent(email)}`}
                    className={
                      isLandingDark
                        ? "block mt-2 text-red-300 hover:text-red-100 underline"
                        : "block mt-2 text-red-600 hover:text-red-700 underline"
                    }
                  >
                    Resend verification email
                  </Link>
                )}
              </div>
            )}

            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={() => handleSSO("google")}
                disabled={ssoLoading !== null}
                className={sso}
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {ssoLoading === "google" ? "Redirecting..." : "Continue with Google"}
              </button>

              <button
                type="button"
                onClick={() => handleSSO("apple")}
                disabled={ssoLoading !== null}
                className={sso}
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                {ssoLoading === "apple" ? "Redirecting..." : "Continue with Apple"}
              </button>

              <button
                type="button"
                onClick={() => handleSSO("microsoft")}
                disabled={ssoLoading !== null}
                className={sso}
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#F25022" d="M1 1h10v10H1z" />
                  <path fill="#00A4EF" d="M1 13h10v10H1z" />
                  <path fill="#7FBA00" d="M13 1h10v10H13z" />
                  <path fill="#FFB900" d="M13 13h10v10H13z" />
                </svg>
                {ssoLoading === "microsoft" ? "Redirecting..." : "Continue with Microsoft"}
              </button>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div
                  className={`w-full border-t ${isLandingDark ? "border-zinc-700" : "border-zinc-200"}`}
                />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className={divLabel}>or continue with email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className={`block text-sm font-medium mb-2 ${labelText}`}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={field}
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className={`block text-sm font-medium ${labelText}`}>
                    Password
                  </label>
                  <Link href="/auth/forgot-password" className={`text-xs transition-colors ${linkMuted}`}>
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={field}
                  placeholder="••••••••"
                />
              </div>

              <button type="submit" disabled={loading} className={submit}>
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <p className={`mt-6 text-center text-sm ${muted}`}>
              Don&apos;t have an account?{" "}
              <Link
                href={`/auth/sign-up${redirectUrl !== "/account" ? `?redirect=${encodeURIComponent(redirectUrl)}` : ""}`}
                className={createLink}
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer
        className={`relative z-10 mt-auto flex justify-center px-8 py-6 text-sm sm:justify-start ${
          desktopAuthFlow
            ? isLandingDark
              ? "border-t border-zinc-900 text-zinc-500"
              : "border-t border-zinc-200 text-zinc-500"
            : isLandingDark
              ? "border-t border-zinc-800 text-zinc-500"
              : "border-t border-zinc-200/80 text-zinc-500"
        }`}
      >
        <p>© 2026 overlay</p>
      </footer>
    </div>
  );
}

export default function SignInPage() {
  return (
    <LandingThemeProvider>
      <Suspense
        fallback={
          <div className="flex min-h-screen flex-col items-center justify-center bg-[linear-gradient(180deg,#fcfcfd_0%,#f5f5f7_56%,#efeff2_100%)]">
            <div className="relative z-10 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
              <p className="mt-4 text-zinc-500">Loading...</p>
            </div>
          </div>
        }
      >
        <SignInContent />
      </Suspense>
    </LandingThemeProvider>
  );
}
