"use client";

import { RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConstellationMap,
  type ConstellationViewport,
} from "../constellation/ConstellationMap";
import { LocalStarlinkCard } from "@/components/home/LocalStarlinkCard";
import { SelectionCard } from "@/components/home/SelectionCard";
import { useUserLocation } from "@/hooks/useUserLocation";

const MAP_POLL_INTERVAL_SECONDS = 10;
const OBSERVER_POLL_INTERVAL_SECONDS = 12;
const DETAIL_POLL_INTERVAL_SECONDS = 8;
const WORLD_SATELLITE_LIMIT = 720;
const REGIONAL_SATELLITE_LIMIT = 1200;
const LOCAL_SATELLITE_LIMIT = 2200;
const LOCAL_LIST_LIMIT = 8;
const VIEWPORT_QUERY_MIN_ZOOM = 2.25;
const LOCAL_PANEL_MIN_ZOOM = 9;

type FeedState = "idle" | "loading" | "ready" | "error";
type MapMode = "overview" | "regional" | "local";

interface SourceMeta {
  provider: string;
  feed: string;
  url: string;
  fetchedAt: string;
  ageMs: number;
  stale: boolean;
}

interface ApiSatellitePoint {
  noradId: number;
  name: string;
  latitude: number;
  longitude: number;
  nextLatitude?: number;
  nextLongitude?: number;
  altitudeKm: number;
  speedKmPerSec: number;
  inclinationDeg?: number;
  orbitalPeriodMinutes?: number;
  rangeKm?: number;
  azimuthDeg?: number;
  elevationDeg?: number;
  aboveHorizon?: boolean;
}

interface SatellitePoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  nextLat?: number | null;
  nextLng?: number | null;
  altitudeKm: number;
  velocityKps: number;
  inclinationDeg?: number | null;
  orbitMinutes?: number | null;
  distanceKm?: number | null;
  azimuthDeg?: number | null;
  elevationDeg?: number | null;
  aboveHorizon?: boolean;
}

interface ApiMapView {
  generatedAt: string;
  source: SourceMeta;
  animation: {
    leadSeconds: number;
  };
  view: {
    mode: MapMode;
    zoom?: number;
    bounds?: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
  };
  satellites: ApiSatellitePoint[];
  sampling: {
    strategy: "global-bucket" | "viewport-bucket" | "full-viewport";
    totalInViewport: number | null;
    returnedCount: number;
  };
}

interface ObserverPass {
  noradId: number;
  name: string;
  riseAt: string;
  peakAt: string;
  setAt: string;
  maxElevationDeg: number;
}

interface ApiObserverView {
  generatedAt: string;
  source: SourceMeta;
  observer: {
    latitude: number;
    longitude: number;
  };
  visibleNow: ApiSatellitePoint[];
  nearest: ApiSatellitePoint[];
  nextPasses: ObserverPass[];
  summary: {
    visibleCount: number;
    nearestRangeKm: number | null;
  };
}

interface ApiSatelliteDetail {
  generatedAt: string;
  source: SourceMeta;
  satellite: ApiSatellitePoint;
  track: Array<{
    timeOffsetSec: number;
    latitude: number;
    longitude: number;
    altitudeKm: number;
  }>;
  observerRelation?: {
    rangeKm: number | null;
    azimuthDeg: number | null;
    elevationDeg: number | null;
    aboveHorizon: boolean;
  };
}

function normalizeLongitude(longitude: number) {
  return ((longitude + 180) % 360 + 360) % 360 - 180;
}

function isLocationInsideViewport(
  location: { lat: number; lng: number } | null | undefined,
  viewport: ConstellationViewport | null | undefined
) {
  if (!location || !viewport) {
    return false;
  }

  if (location.lat < viewport.south || location.lat > viewport.north) {
    return false;
  }

  const longitude = normalizeLongitude(location.lng);
  const west = normalizeLongitude(viewport.west);
  const east = normalizeLongitude(viewport.east);

  if (east >= west) {
    return longitude >= west && longitude <= east;
  }

  return longitude >= west || longitude <= east;
}

function normalizeSatellite(satellite: ApiSatellitePoint): SatellitePoint {
  return {
    id: satellite.noradId.toString(),
    name: satellite.name,
    lat: satellite.latitude,
    lng: satellite.longitude,
    nextLat: satellite.nextLatitude ?? null,
    nextLng: satellite.nextLongitude ?? null,
    altitudeKm: satellite.altitudeKm,
    velocityKps: satellite.speedKmPerSec,
    inclinationDeg: satellite.inclinationDeg ?? null,
    orbitMinutes: satellite.orbitalPeriodMinutes ?? null,
    distanceKm: satellite.rangeKm ?? null,
    azimuthDeg: satellite.azimuthDeg ?? null,
    elevationDeg: satellite.elevationDeg ?? null,
    aboveHorizon: satellite.aboveHorizon ?? false,
  };
}

function getSatelliteLimit(viewport?: ConstellationViewport | null) {
  if (!viewport) {
    return WORLD_SATELLITE_LIMIT;
  }

  if (viewport.zoom >= 8) {
    return LOCAL_SATELLITE_LIMIT;
  }

  if (viewport.zoom >= 4) {
    return REGIONAL_SATELLITE_LIMIT;
  }

  return WORLD_SATELLITE_LIMIT;
}

function getRequestViewport(viewport?: ConstellationViewport | null) {
  if (!viewport || viewport.zoom < VIEWPORT_QUERY_MIN_ZOOM) {
    return null;
  }

  return viewport;
}

function resolveMapMode(viewport?: ConstellationViewport | null): MapMode {
  if (!viewport) {
    return "overview";
  }

  if (viewport.zoom >= 8) {
    return "local";
  }

  if (viewport.zoom >= 4) {
    return "regional";
  }

  return "overview";
}

function buildMapEndpoint(options: {
  viewport?: ConstellationViewport | null;
  selectedNoradId?: number | null;
  userLocation?: { lat: number; lng: number } | null;
}) {
  const requestViewport = getRequestViewport(options.viewport);
  const searchParams = new URLSearchParams({
    limit: String(getSatelliteLimit(requestViewport)),
    mode: resolveMapMode(requestViewport),
  });

  if (requestViewport) {
    searchParams.set("west", requestViewport.west.toFixed(6));
    searchParams.set("south", requestViewport.south.toFixed(6));
    searchParams.set("east", requestViewport.east.toFixed(6));
    searchParams.set("north", requestViewport.north.toFixed(6));
    searchParams.set("zoom", requestViewport.zoom.toFixed(3));
  }

  if (typeof options.selectedNoradId === "number" && Number.isFinite(options.selectedNoradId)) {
    searchParams.set("selectedNoradId", String(Math.trunc(options.selectedNoradId)));
  }

  if (options.userLocation) {
    searchParams.set("lat", options.userLocation.lat.toFixed(6));
    searchParams.set("lng", options.userLocation.lng.toFixed(6));
  }

  return `/api/starlink/map?${searchParams.toString()}`;
}

function buildObserverEndpoint(location: { lat: number; lng: number }) {
  const searchParams = new URLSearchParams({
    lat: location.lat.toFixed(6),
    lng: location.lng.toFixed(6),
  });

  return `/api/starlink/observer?${searchParams.toString()}`;
}

function buildSatelliteEndpoint(options: {
  noradId: number;
  userLocation?: { lat: number; lng: number } | null;
}) {
  const searchParams = new URLSearchParams();

  if (options.userLocation) {
    searchParams.set("lat", options.userLocation.lat.toFixed(6));
    searchParams.set("lng", options.userLocation.lng.toFixed(6));
  }

  return `/api/starlink/satellite/${options.noradId}?${searchParams.toString()}`;
}

async function fetchJson<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(endpoint, {
    cache: "no-store",
    signal,
  });
  const payload = (await response.json()) as T | { error?: { message?: string } };
  const errorPayload =
    typeof payload === "object" && payload !== null && "error" in payload
      ? payload.error
      : undefined;

  if (!response.ok) {
    throw new Error(
      errorPayload?.message
        ? errorPayload.message
        : `Request failed with status ${response.status}`
    );
  }

  return payload as T;
}

export function StarlinkExperience() {
  const {
    location,
    status: userLocationStatus,
    refresh: refreshUserLocation,
  } = useUserLocation();
  const [mapView, setMapView] = useState<ApiMapView | null>(null);
  const [observerView, setObserverView] = useState<ApiObserverView | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<ApiSatelliteDetail | null>(null);
  const [mapFeedState, setMapFeedState] = useState<FeedState>("loading");
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedSatelliteId, setSelectedSatelliteId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ConstellationViewport | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const viewportRef = useRef<ConstellationViewport | null>(viewport);
  const mapRequestSequenceRef = useRef(0);
  const observerRequestSequenceRef = useRef(0);
  const detailRequestSequenceRef = useRef(0);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  const localModeActive =
    userLocationStatus === "ready" &&
    Boolean(location) &&
    Boolean(viewport && viewport.zoom >= LOCAL_PANEL_MIN_ZOOM) &&
    isLocationInsideViewport(location, viewport);

  const selectedNoradId =
    selectedSatelliteId && /^\d+$/.test(selectedSatelliteId)
      ? Number.parseInt(selectedSatelliteId, 10)
      : null;

  const loadMapView = useCallback(async (signal?: AbortSignal) => {
    const requestSequence = mapRequestSequenceRef.current + 1;
    mapRequestSequenceRef.current = requestSequence;
    const requestViewport = viewportRef.current;

    setMapFeedState((current) => (current === "ready" ? "ready" : "loading"));

    try {
      const response = await fetchJson<ApiMapView>(
        buildMapEndpoint({
          viewport: requestViewport,
          selectedNoradId,
          userLocation: localModeActive ? location : null,
        }),
        signal
      );

      if (signal?.aborted || requestSequence !== mapRequestSequenceRef.current) {
        return;
      }

      setMapView(response);
      setMapFeedState("ready");
      setMapError(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setMapFeedState("error");
      setMapError(error instanceof Error ? error.message : "Unable to load the constellation.");
    }
  }, [localModeActive, location, selectedNoradId]);

  const loadObserverView = useCallback(async (signal?: AbortSignal) => {
    if (!location || !localModeActive) {
      setObserverView(null);
      return;
    }

    const requestSequence = observerRequestSequenceRef.current + 1;
    observerRequestSequenceRef.current = requestSequence;

    try {
      const response = await fetchJson<ApiObserverView>(
        buildObserverEndpoint(location),
        signal
      );

      if (signal?.aborted || requestSequence !== observerRequestSequenceRef.current) {
        return;
      }

      setObserverView(response);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setObserverView(null);
    }
  }, [localModeActive, location]);

  const loadSelectedDetail = useCallback(async (signal?: AbortSignal) => {
    if (!selectedNoradId) {
      setSelectedDetail(null);
      return;
    }

    const requestSequence = detailRequestSequenceRef.current + 1;
    detailRequestSequenceRef.current = requestSequence;

    try {
      const response = await fetchJson<ApiSatelliteDetail>(
        buildSatelliteEndpoint({
          noradId: selectedNoradId,
          userLocation: location,
        }),
        signal
      );

      if (signal?.aborted || requestSequence !== detailRequestSequenceRef.current) {
        return;
      }

      setSelectedDetail(response);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setSelectedDetail(null);
    }
  }, [location, selectedNoradId]);

  useEffect(() => {
    const controller = new AbortController();
    let timeoutId: number | null = null;
    let startupId: number | null = null;
    let active = true;

    const scheduleNext = () => {
      timeoutId = window.setTimeout(() => {
        if (!active) {
          return;
        }

        void loadMapView(controller.signal).finally(() => {
          if (active) {
            scheduleNext();
          }
        });
      }, MAP_POLL_INTERVAL_SECONDS * 1000);
    };

    startupId = window.setTimeout(() => {
      void loadMapView(controller.signal).finally(() => {
        if (active) {
          scheduleNext();
        }
      });
    }, 0);

    return () => {
      active = false;
      controller.abort();
      if (startupId != null) {
        window.clearTimeout(startupId);
      }
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [loadMapView, refreshTick, viewport, selectedNoradId]);

  useEffect(() => {
    const controller = new AbortController();
    let timeoutId: number | null = null;
    let startupId: number | null = null;
    let active = true;

    const scheduleNext = () => {
      timeoutId = window.setTimeout(() => {
        if (!active) {
          return;
        }

        void loadObserverView(controller.signal).finally(() => {
          if (active) {
            scheduleNext();
          }
        });
      }, OBSERVER_POLL_INTERVAL_SECONDS * 1000);
    };

    startupId = window.setTimeout(() => {
      void loadObserverView(controller.signal).finally(() => {
        if (active && localModeActive) {
          scheduleNext();
        }
      });
    }, 0);

    return () => {
      active = false;
      controller.abort();
      if (startupId != null) {
        window.clearTimeout(startupId);
      }
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [loadObserverView, localModeActive, refreshTick]);

  useEffect(() => {
    const controller = new AbortController();
    let timeoutId: number | null = null;
    let startupId: number | null = null;
    let active = true;

    const scheduleNext = () => {
      timeoutId = window.setTimeout(() => {
        if (!active) {
          return;
        }

        void loadSelectedDetail(controller.signal).finally(() => {
          if (active && selectedNoradId) {
            scheduleNext();
          }
        });
      }, DETAIL_POLL_INTERVAL_SECONDS * 1000);
    };

    startupId = window.setTimeout(() => {
      void loadSelectedDetail(controller.signal).finally(() => {
        if (active && selectedNoradId) {
          scheduleNext();
        }
      });
    }, 0);

    return () => {
      active = false;
      controller.abort();
      if (startupId != null) {
        window.clearTimeout(startupId);
      }
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [loadSelectedDetail, refreshTick, selectedNoradId]);

  const handleSelectSatellite = useCallback((satelliteId: string | null) => {
    if (satelliteId == null) {
      setSelectedSatelliteId(null);
      return;
    }

    setSelectedSatelliteId((current) => (current === satelliteId ? null : satelliteId));
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedSatelliteId(null);
  }, []);

  const mapSatellites = useMemo(() => {
    const normalized = (mapView?.satellites ?? []).map(normalizeSatellite);
    const selected = selectedDetail ? normalizeSatellite(selectedDetail.satellite) : null;

    if (selected && !normalized.some((satellite) => satellite.id === selected.id)) {
      return [selected, ...normalized];
    }

    return normalized;
  }, [mapView, selectedDetail]);

  const selectedSatellite = useMemo(() => {
    if (selectedDetail) {
      return normalizeSatellite(selectedDetail.satellite);
    }

    if (!selectedSatelliteId) {
      return null;
    }

    return (
      mapSatellites.find((satellite) => satellite.id === selectedSatelliteId) ??
      observerView?.visibleNow
        .map(normalizeSatellite)
        .find((satellite) => satellite.id === selectedSatelliteId) ??
      observerView?.nearest
        .map(normalizeSatellite)
        .find((satellite) => satellite.id === selectedSatelliteId) ??
      null
    );
  }, [mapSatellites, observerView, selectedDetail, selectedSatelliteId]);

  const focusTrack = useMemo(
    () =>
      selectedDetail?.track.map((point) => ({
        lat: point.latitude,
        lng: point.longitude,
        minutesFromNow: point.timeOffsetSec / 60,
        altitudeKm: point.altitudeKm,
      })) ?? [],
    [selectedDetail]
  );

  const localSatellites = useMemo(() => {
    if (!observerView) {
      return [];
    }

    const visibleNow = observerView.visibleNow.map(normalizeSatellite).sort((left, right) => {
      if (left.aboveHorizon !== right.aboveHorizon) {
        return left.aboveHorizon ? -1 : 1;
      }

      const leftDistance = typeof left.distanceKm === "number" ? left.distanceKm : Number.POSITIVE_INFINITY;
      const rightDistance = typeof right.distanceKm === "number" ? right.distanceKm : Number.POSITIVE_INFINITY;

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      const leftElevation = typeof left.elevationDeg === "number" ? left.elevationDeg : -1;
      const rightElevation = typeof right.elevationDeg === "number" ? right.elevationDeg : -1;
      return rightElevation - leftElevation;
    });

    if (visibleNow.length > 0) {
      return visibleNow.slice(0, LOCAL_LIST_LIMIT);
    }

    return observerView.nearest
      .map(normalizeSatellite)
      .sort((left, right) => {
        const leftDistance = typeof left.distanceKm === "number" ? left.distanceKm : Number.POSITIVE_INFINITY;
        const rightDistance = typeof right.distanceKm === "number" ? right.distanceKm : Number.POSITIVE_INFINITY;
        return leftDistance - rightDistance;
      })
      .slice(0, LOCAL_LIST_LIMIT);
  }, [observerView]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02040a] text-white">
      <div className="absolute inset-0">
        <ConstellationMap
          satellites={mapSatellites}
          generatedAt={mapView?.generatedAt ?? ""}
          motionLeadSeconds={mapView?.animation?.leadSeconds}
          selectedSatelliteId={selectedSatelliteId}
          onSelect={handleSelectSatellite}
          onViewportChange={(nextViewport) => {
            setViewport((current) => {
              if (
                current &&
                Math.abs(current.west - nextViewport.west) < 0.05 &&
                Math.abs(current.south - nextViewport.south) < 0.05 &&
                Math.abs(current.east - nextViewport.east) < 0.05 &&
                Math.abs(current.north - nextViewport.north) < 0.05 &&
                Math.abs(current.zoom - nextViewport.zoom) < 0.025
              ) {
                return current;
              }

              return nextViewport;
            });
          }}
          userLocation={location}
          userLocationStatus={userLocationStatus}
          onLocateUser={refreshUserLocation}
          status={mapFeedState}
          focusTrack={focusTrack}
          className="h-screen w-screen !min-h-screen !rounded-none !border-0 !p-0 !shadow-none"
        />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(2,4,10,0.35)_100%)]" />

      {selectedSatellite ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex justify-center sm:inset-x-auto sm:right-4 sm:bottom-4 sm:justify-end">
          <div className="pointer-events-auto w-full max-w-[28rem]">
            <SelectionCard satellite={selectedSatellite} onClear={handleClearSelection} />
          </div>
        </div>
      ) : null}

      {localModeActive ? (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex justify-center sm:inset-x-auto sm:left-4 sm:top-auto sm:bottom-4 sm:justify-start">
          <div className="pointer-events-auto w-full max-w-[28rem]">
            <LocalStarlinkCard
              satellites={localSatellites}
              selectedSatelliteId={selectedSatelliteId}
              onSelect={handleSelectSatellite}
              visibleCount={observerView?.summary.visibleCount}
              nearestDistanceKm={observerView?.summary.nearestRangeKm ?? null}
              title="Local sky"
              emptyLabel={
                observerView?.nextPasses?.length
                  ? `No Starlinks are above your horizon right now. Next rise: ${observerView.nextPasses[0]?.name}.`
                  : "No Starlinks are above your horizon right now."
              }
            />
          </div>
        </div>
      ) : null}

      {mapFeedState === "error" ? (
        <div className="absolute inset-x-4 top-4 z-20 flex justify-center">
          <button
            type="button"
            onClick={() => setRefreshTick((value) => value + 1)}
            className="map-glass-control h-11 w-11 border-rose-400/20 text-rose-100 hover:border-rose-300/40"
            aria-label="Reconnect live feed"
            title={mapError ?? "Reconnect live feed"}
          >
            <RefreshCcw className="h-4.5 w-4.5" />
            <span className="sr-only">{mapError ?? "Reconnect live feed"}</span>
          </button>
        </div>
      ) : null}
    </main>
  );
}
