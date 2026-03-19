import { NextRequest, NextResponse } from "next/server";
import {
  getStarlinkSatelliteDetail,
  parseStarlinkQueryCoordinate,
  StarlinkDataError,
  validateStarlinkCoordinates,
} from "@/lib/starlink";
import { buildErrorResponse } from "../../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ noradId: string }> }
) {
  try {
    const { noradId } = await context.params;
    const parsedNoradId = Number.parseInt(noradId, 10);

    if (!Number.isInteger(parsedNoradId) || parsedNoradId <= 0) {
      throw new StarlinkDataError("noradId must be a positive integer", {
        code: "STARLINK_NORAD_INVALID",
        status: 400,
      });
    }

    const url = new URL(req.url);
    const lat = parseStarlinkQueryCoordinate(url.searchParams.get("lat"));
    const lng = parseStarlinkQueryCoordinate(url.searchParams.get("lng"));
    const observer =
      lat === undefined && lng === undefined
        ? undefined
        : validateStarlinkCoordinates(lat, lng);

    const response = await getStarlinkSatelliteDetail({
      noradId: parsedNoradId,
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
