import { NextResponse } from "next/server";
import { fetchLatestReleaseInfo } from "@/lib/latest-release";

import { z } from '@/lib/api-schemas'

const LatestReleaseRequestSchema = z.object({}).openapi('LatestReleaseRequest')
const LatestReleaseResponseSchema = z.unknown().openapi('LatestReleaseResponse')
void LatestReleaseRequestSchema
void LatestReleaseResponseSchema

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
