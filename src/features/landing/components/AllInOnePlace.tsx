"use client";

/**
 * Marketing “all in one place” block — typography only (no overlay panels).
 */
export function AllInOnePlace({
  theme = "light",
}: {
  theme?: "light" | "dark";
}) {
  const isDark = theme === "dark";
  const heading = isDark ? "text-zinc-100" : "text-[#0a0a0a]";
  const sub = isDark ? "text-zinc-400" : "text-[#71717a]";

  return (
    <div className="relative flex w-full max-w-3xl flex-col items-center justify-center gap-3 px-4 text-center">
      <p className={`font-serif text-4xl md:text-5xl lg:text-6xl ${heading}`}>all in</p>
      <p className={`font-serif text-4xl md:text-5xl lg:text-6xl ${heading}`}>one place</p>
      <p className={`mt-2 max-w-md text-sm ${sub}`}>
        notes, chats, browser, and agents — together in your overlay bar.
      </p>
    </div>
  );
}
