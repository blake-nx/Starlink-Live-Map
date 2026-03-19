import { NextResponse } from "next/server";
import {
  parseStarlinkQueryCoordinate,
  parseStarlinkQueryLimit,
  parseStarlinkQueryZoom,
  StarlinkDataError,
  validateStarlinkCoordinates,
  validateStarlinkViewport,
} from "@/lib/starlink";

export function buildErrorResponse(error: unknown): NextResponse {
  if (error instanceof StarlinkDataError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      {
        status: error.status,
        headers: {
          "cache-control": "no-store, max-age=0",
        },
      }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "STARLINK_UNEXPECTED_ERROR",
        message: "Unable to fulfill the Starlink request.",
      },
    },
    {
      status: 500,
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    }
  );
}

export function readObserverParams(searchParams: URLSearchParams) {
  const lat = parseStarlinkQueryCoordinate(searchParams.get("lat"));
  const lng = parseStarlinkQueryCoordinate(searchParams.get("lng"));

  if (lat === undefined && lng === undefined) {
    return null;
  }

  return validateStarlinkCoordinates(lat, lng);
}

export function readViewportParams(searchParams: URLSearchParams) {
  const north = parseStarlinkQueryCoordinate(searchParams.get("north"));
  const south = parseStarlinkQueryCoordinate(searchParams.get("south"));
  const east = parseStarlinkQueryCoordinate(searchParams.get("east"));
  const west = parseStarlinkQueryCoordinate(searchParams.get("west"));

  if ([north, south, east, west].every((value) => value === undefined)) {
    return null;
  }

  return validateStarlinkViewport(north, south, east, west);
}

export function readLimitParam(searchParams: URLSearchParams) {
  return parseStarlinkQueryLimit(searchParams.get("limit"));
}

export function readZoomParam(searchParams: URLSearchParams) {
  return parseStarlinkQueryZoom(searchParams.get("zoom"));
}
