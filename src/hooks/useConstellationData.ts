import { useEffect, useMemo, useState } from "react";

export type ConstellationStatus =
  | "live"
  | "syncing"
  | "stale"
  | "offline"
  | "error";

export interface ConstellationSatellite {
  id: string;
  name?: string;
  lat: number;
  lng: number;
  altitudeKm?: number;
  velocityKps?: number;
  shell?: string;
  status?: "active" | "inactive" | "degraded" | string;
}

export interface ConstellationUserLocation {
  lat: number;
  lng: number;
  label?: string;
  accuracyKm?: number;
}

export interface ConstellationMetrics {
  total: number;
  averageAltitudeKm: number | null;
  averageSpeedKps: number | null;
  northHemisphere: number;
  southHemisphere: number;
  eastHemisphere: number;
  westHemisphere: number;
  altitudeBands: {
    low: number;
    medium: number;
    high: number;
  };
  shellBreakdown: Array<{
    shell: string;
    count: number;
  }>;
}

export interface ConstellationSnapshot {
  satellites: ConstellationSatellite[];
  generatedAt: string | Date;
  source?: string;
  userLocation?: ConstellationUserLocation | null;
  status?: ConstellationStatus;
}

export interface UseConstellationDataResult {
  satellites: ConstellationSatellite[];
  generatedAt: Date;
  source: string;
  status: ConstellationStatus;
  ageMs: number;
  ageLabel: string;
  isStale: boolean;
  selectedSatellite: ConstellationSatellite | null;
  nearestSatellites: Array<ConstellationSatellite & { distanceKm: number }>;
  metrics: ConstellationMetrics;
}

export interface UseConstellationDataOptions extends ConstellationSnapshot {
  selectedSatelliteId?: string | null;
}

const STALE_AFTER_MS = 20_000;

function toDate(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function haversineKm(
  latA: number,
  lngA: number,
  latB: number,
  lngB: number
): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6_371;
  const dLat = toRad(latB - latA);
  const dLng = toRad(lngB - lngA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(a)));
}

function formatAge(ageMs: number): string {
  if (ageMs < 1_000) {
    return "just now";
  }

  if (ageMs < 60_000) {
    const seconds = Math.max(1, Math.round(ageMs / 1_000));
    return `${seconds}s ago`;
  }

  const minutes = Math.round(ageMs / 60_000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function groupShells(satellites: ConstellationSatellite[]) {
  const counts = new Map<string, number>();

  for (const satellite of satellites) {
    const shell =
      satellite.shell?.trim() ||
      (satellite.altitudeKm != null
        ? satellite.altitudeKm < 400
          ? "LEO-compact"
          : satellite.altitudeKm < 700
            ? "LEO-cruise"
            : "LEO-high"
        : "unclassified");
    counts.set(shell, (counts.get(shell) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([shell, count]) => ({ shell, count }))
    .sort((a, b) => b.count - a.count || a.shell.localeCompare(b.shell));
}

export function useConstellationData({
  satellites,
  generatedAt,
  source = "live constellation feed",
  userLocation = null,
  status = "live",
  selectedSatelliteId = null,
}: UseConstellationDataOptions): UseConstellationDataResult {
  const [now, setNow] = useState(() => Date.now());
  const normalizedGeneratedAt = useMemo(() => toDate(generatedAt), [generatedAt]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const ageMs = Math.max(0, now - normalizedGeneratedAt.getTime());
  const ageLabel = formatAge(ageMs);
  const isStale = ageMs > STALE_AFTER_MS;

  const metrics = useMemo<ConstellationMetrics>(() => {
    const total = satellites.length;
    let altitudeSum = 0;
    let speedSum = 0;
    let altitudeCount = 0;
    let speedCount = 0;
    let northHemisphere = 0;
    let southHemisphere = 0;
    let eastHemisphere = 0;
    let westHemisphere = 0;

    for (const satellite of satellites) {
      const lat = toFiniteNumber(satellite.lat);
      const lng = toFiniteNumber(satellite.lng);

      if (lat >= 0) {
        northHemisphere += 1;
      } else {
        southHemisphere += 1;
      }

      if (lng >= 0) {
        eastHemisphere += 1;
      } else {
        westHemisphere += 1;
      }

      if (typeof satellite.altitudeKm === "number" && Number.isFinite(satellite.altitudeKm)) {
        altitudeSum += satellite.altitudeKm;
        altitudeCount += 1;
      }

      if (
        typeof satellite.velocityKps === "number" &&
        Number.isFinite(satellite.velocityKps)
      ) {
        speedSum += satellite.velocityKps;
        speedCount += 1;
      }
    }

    const altitudeBands = satellites.reduce(
      (bands, satellite) => {
        const altitude = satellite.altitudeKm;
        if (typeof altitude !== "number" || !Number.isFinite(altitude)) {
          return bands;
        }

        if (altitude < 400) {
          bands.low += 1;
        } else if (altitude < 700) {
          bands.medium += 1;
        } else {
          bands.high += 1;
        }

        return bands;
      },
      { low: 0, medium: 0, high: 0 }
    );

    return {
      total,
      averageAltitudeKm: altitudeCount > 0 ? altitudeSum / altitudeCount : null,
      averageSpeedKps: speedCount > 0 ? speedSum / speedCount : null,
      northHemisphere,
      southHemisphere,
      eastHemisphere,
      westHemisphere,
      altitudeBands,
      shellBreakdown: groupShells(satellites),
    };
  }, [satellites]);

  const selectedSatellite = useMemo(() => {
    if (!selectedSatelliteId) {
      return null;
    }

    return satellites.find((satellite) => satellite.id === selectedSatelliteId) ?? null;
  }, [satellites, selectedSatelliteId]);

  const nearestSatellites = useMemo(() => {
    if (!userLocation) {
      return [];
    }

    return satellites
      .map((satellite) => ({
        ...satellite,
        distanceKm: haversineKm(userLocation.lat, userLocation.lng, satellite.lat, satellite.lng),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 5);
  }, [satellites, userLocation]);

  return {
    satellites,
    generatedAt: normalizedGeneratedAt,
    source,
    status,
    ageMs,
    ageLabel,
    isStale,
    selectedSatellite,
    nearestSatellites,
    metrics,
  };
}
