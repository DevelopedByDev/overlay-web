/** Consistent marketing / auth surfaces — avoids inheriting app `data-theme` text colors on white buttons. */

export function marketingAuthCard(isDark: boolean): string {
  return isDark
    ? "rounded-2xl border border-zinc-700/90 bg-zinc-950/90 p-8 shadow-2xl backdrop-blur-md"
    : "rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm";
}

export function marketingAuthMuted(isDark: boolean): string {
  return isDark ? "text-zinc-400" : "text-zinc-500";
}

export function marketingSsoButton(isDark: boolean): string {
  return [
    "w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 border",
    isDark
      ? "bg-zinc-800/90 border-zinc-600 text-zinc-100 hover:bg-zinc-700"
      : "bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50",
  ].join(" ");
}

export function marketingPrimaryField(isDark: boolean): string {
  return [
    "w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 border",
    isDark
      ? "bg-zinc-900 border-zinc-600 text-zinc-100 placeholder:text-zinc-500 focus:ring-zinc-500"
      : "bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:ring-zinc-900",
  ].join(" ");
}

export function marketingSubmitButton(isDark: boolean): string {
  return [
    "w-full py-3 px-4 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50",
    isDark
      ? "bg-zinc-100 text-zinc-900 hover:opacity-90"
      : "bg-zinc-900 text-white hover:opacity-90",
  ].join(" ");
}

export function marketingDividerLabel(isDark: boolean): string {
  return isDark
    ? "px-4 bg-zinc-950 text-zinc-400"
    : "px-4 bg-white text-zinc-500";
}

/** Account / pricing cards — do not use `glass-dark` (it follows app `data-theme`, not landing theme). */
export function marketingPanel(isLandingDark: boolean): string {
  return isLandingDark
    ? "border border-zinc-700 bg-zinc-900 p-6"
    : "border border-zinc-200 bg-white p-6";
}

export function marketingPanelLg(isLandingDark: boolean): string {
  return isLandingDark
    ? "mx-auto max-w-md rounded-2xl border border-zinc-700 bg-zinc-900/95 p-8 shadow-lg"
    : "mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm";
}

/** Typography for marketing surfaces — always pair with `marketingPanel` / light cards. */
export function marketingPageTitle(isLandingDark: boolean): string {
  return isLandingDark ? "text-zinc-100" : "text-zinc-900";
}

export function marketingHeading(isLandingDark: boolean): string {
  return isLandingDark ? "text-zinc-100" : "text-zinc-900";
}

export function marketingBody(isLandingDark: boolean): string {
  return isLandingDark ? "text-zinc-300" : "text-zinc-600";
}

export function marketingMuted(isLandingDark: boolean): string {
  return isLandingDark ? "text-zinc-400" : "text-zinc-500";
}

export function marketingFeatureText(isLandingDark: boolean, included: boolean): string {
  if (!included) {
    return isLandingDark ? "text-zinc-500" : "text-zinc-400";
  }
  return isLandingDark ? "text-zinc-300" : "text-zinc-700";
}
