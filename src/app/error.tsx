"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Page Error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafafa] text-[#0a0a0a]">
      <h1 className="text-2xl font-medium mb-4">something went wrong</h1>
      <button
        onClick={reset}
        className="px-4 py-2 bg-[#0a0a0a] text-white rounded-full text-sm hover:bg-[#27272a] transition-colors"
      >
        try again
      </button>
    </div>
  );
}
