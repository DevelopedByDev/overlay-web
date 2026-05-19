import { NextResponse } from "next/server";
import { fetchLatestReleaseInfo } from "@/shared/web/latest-release";

export async function GET() {
  try {
    const releaseInfo = await fetchLatestReleaseInfo();
    return NextResponse.json(releaseInfo);
  } catch (error) {
    console.error("Failed to fetch latest release:", error);
    return NextResponse.json(
      { error: "Failed to fetch latest release" },
      { status: 500 }
    );
  }
}
