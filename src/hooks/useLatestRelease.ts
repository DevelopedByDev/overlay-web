import { useState, useEffect, useCallback } from "react";

interface ReleaseInfo {
  version: string;
  downloadUrl: string;
  releaseName: string;
  publishedAt: string;
}

const FALLBACK_URL = "https://github.com/DevelopedByDev/overlay-releases/releases";
const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds

export function useLatestRelease() {
  const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRelease = useCallback(async () => {
    try {
      const response = await fetch("/api/latest-release");
      if (!response.ok) {
        // Silently fail - will use fallback URL
        setError("Failed to fetch release");
        return;
      }
      const data = await response.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setReleaseInfo(data);
      setError(null);
    } catch {
      // Silently fail - will use fallback URL
      setError("Failed to fetch release");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRelease();

    const interval = setInterval(fetchRelease, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchRelease]);

  return {
    downloadUrl: releaseInfo?.downloadUrl ?? FALLBACK_URL,
    version: releaseInfo?.version ?? null,
    isLoading,
    error,
  };
}
