import { NextRequest, NextResponse } from "next/server";
import { getStarlinkObserverView, StarlinkDataError } from "@/lib/starlink";
import {
  buildErrorResponse,
  readObserverParams,
} from "../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const observer = readObserverParams(url.searchParams);

    if (!observer) {
      throw new StarlinkDataError("lat and lng are required for observer view", {
        code: "STARLINK_COORDINATES_REQUIRED",
        status: 400,
      });
    }

    const response = await getStarlinkObserverView({
      lat: observer.latitude,
      lng: observer.longitude,
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
