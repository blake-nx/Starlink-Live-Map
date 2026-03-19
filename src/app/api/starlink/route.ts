import { NextRequest, NextResponse } from "next/server";
import {
  clampStarlinkLimit,
  getStarlinkSnapshot,
  parseStarlinkQueryFocusNoradId,
} from "@/lib/starlink";
import {
  buildErrorResponse,
  readLimitParam,
  readObserverParams,
  readViewportParams,
} from "./shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const observer = readObserverParams(url.searchParams);
    const viewport = readViewportParams(url.searchParams);
    const limit = clampStarlinkLimit(readLimitParam(url.searchParams));
    const focusNoradId = parseStarlinkQueryFocusNoradId(url.searchParams.get("focusNoradId"));

    const snapshotOptions: {
      lat?: number;
      lng?: number;
      limit: number;
      focusNoradId?: number;
      viewport?: {
        north: number;
        south: number;
        east: number;
        west: number;
      };
    } = { limit };

    if (observer) {
      snapshotOptions.lat = observer.latitude;
      snapshotOptions.lng = observer.longitude;
    }

    if (viewport) {
      snapshotOptions.viewport = viewport;
    }

    if (focusNoradId !== undefined) {
      snapshotOptions.focusNoradId = focusNoradId;
    }

    const snapshot = await getStarlinkSnapshot(snapshotOptions);

    return NextResponse.json(snapshot, {
      status: 200,
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return buildErrorResponse(error);
  }
}
