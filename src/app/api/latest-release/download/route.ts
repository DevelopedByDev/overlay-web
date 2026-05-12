import { NextResponse } from "next/server";
import {
  CACHE_DURATION,
  fetchLatestReleaseInfo,
} from "@/lib/latest-release";

import { z } from '@/lib/api-schemas'

const LatestReleaseDownloadRequestSchema = z.object({}).openapi('LatestReleaseDownloadRequest')
const LatestReleaseDownloadResponseSchema = z.unknown().openapi('LatestReleaseDownloadResponse')
void LatestReleaseDownloadRequestSchema
void LatestReleaseDownloadResponseSchema

export async function GET() {
  try {
    const { downloadUrl } = await fetchLatestReleaseInfo();
    const response = NextResponse.redirect(downloadUrl, 307);

    response.headers.set(
      "Cache-Control",
      `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=86400`
    );

    return response;
  } catch (error) {
    console.error("Failed to redirect latest release download:", error);
    return NextResponse.json(
      { error: "Failed to fetch latest release download" },
      { status: 500 }
    );
  }
}
