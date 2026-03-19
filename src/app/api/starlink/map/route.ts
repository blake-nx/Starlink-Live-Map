import { NextRequest, NextResponse } from "next/server";
import {
  clampStarlinkLimit,
  getStarlinkMapView,
  parseStarlinkMapMode,
  parseStarlinkQueryFocusNoradId,
} from "@/lib/starlink";
import {
  buildErrorResponse,
  readLimitParam,
  readObserverParams,
  readViewportParams,
  readZoomParam,
} from "../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const observer = readObserverParams(url.searchParams);
    const viewport = readViewportParams(url.searchParams);
    const zoom = readZoomParam(url.searchParams);
    const focusNoradId =
      parseStarlinkQueryFocusNoradId(url.searchParams.get("selectedNoradId")) ??
      parseStarlinkQueryFocusNoradId(url.searchParams.get("focusNoradId"));
    const limit = clampStarlinkLimit(readLimitParam(url.searchParams));
    const requestedMode = parseStarlinkMapMode(url.searchParams.get("mode"));

    const response = await getStarlinkMapView({
      limit,
      focusNoradId,
      viewport: viewport ?? undefined,
      zoom: zoom ?? undefined,
      mode: requestedMode,
      lat: observer?.latitude,
      lng: observer?.longitude,
    });

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return buildErrorResponse(error);
  }
}
