import * as satellite from "satellite.js";

const DEFAULT_STARLINK_SOURCE_URL =
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle";
const FALLBACK_STARLINK_SOURCE_URL =
  "https://celestrak.com/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle";

export const STARLINK_SOURCE_URL =
  process.env.STARLINK_TLE_URL ??
  process.env.NEXT_PUBLIC_STARLINK_TLE_URL ??
  DEFAULT_STARLINK_SOURCE_URL;

const STARLINK_SOURCE_URLS = Array.from(
  new Set(
    STARLINK_SOURCE_URL === DEFAULT_STARLINK_SOURCE_URL
      ? [STARLINK_SOURCE_URL, FALLBACK_STARLINK_SOURCE_URL]
      : [STARLINK_SOURCE_URL]
  )
);

const CACHE_TTL_MS = 10 * 60 * 1000;
const STALE_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12 * 1000;
const FETCH_RETRY_ATTEMPTS = 2;
const FETCH_RETRY_DELAY_MS = 450;
const PROPAGATED_CACHE_TTL_MS = 4 * 1000;
const MOTION_LOOKAHEAD_SECONDS = 20;
const DEFAULT_LIMIT = 600;
const MAX_LIMIT = 2500;
const DEFAULT_NEAREST_LIMIT = 8;
const FOCUS_TRACK_WINDOW_MINUTES = 60;
const FOCUS_TRACK_INTERVAL_MINUTES = 2;
const GLOBAL_MAP_BUCKET_ROWS = 24;
const GLOBAL_MAP_BUCKET_COLUMNS = 48;
const LOCAL_MAP_BUCKET_ROWS = 16;
const LOCAL_MAP_BUCKET_COLUMNS = 32;
const NEXT_PASS_WINDOW_MINUTES = 90;
const NEXT_PASS_STEP_SECONDS = 60;

type SatelliteRecord = ReturnType<typeof satellite.twoline2satrec>;
type GeodeticObserver = {
  latitude: number;
  longitude: number;
  height: number;
};

type StarlinkViewportBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type StarlinkShellBand =
  | "below-450km"
  | "450-500km"
  | "500-550km"
  | "550-600km"
  | "600km-plus";

export interface StarlinkSatellitePoint {
  noradId: number;
  name: string;
  epoch: string;
  latitude: number;
  longitude: number;
  nextLatitude?: number;
  nextLongitude?: number;
  altitudeKm: number;
  speedKmPerSec: number;
  speedKph: number;
  inclinationDeg: number;
  raanDeg: number;
  argumentOfPerigeeDeg: number;
  meanAnomalyDeg: number;
  meanMotionRevPerDay: number;
  orbitalPeriodMinutes: number;
  shellBand: StarlinkShellBand;
  rangeKm?: number;
  azimuthDeg?: number;
  elevationDeg?: number;
  aboveHorizon?: boolean;
}

export interface StarlinkMetrics {
  totalCount: number;
  averageAltitudeKm: number;
  averageSpeedKmPerSec: number;
  shellBreakdown: Record<StarlinkShellBand, number>;
  hemisphereBreakdown: {
    northern: number;
    southern: number;
    eastern: number;
    western: number;
    northeast: number;
    northwest: number;
    southeast: number;
    southwest: number;
  };
}

export interface StarlinkUserContext {
  observer: {
    latitude: number;
    longitude: number;
  };
  visibleSatellites: StarlinkSatellitePoint[];
  nearestSatellites: StarlinkSatellitePoint[];
  visibleCount: number;
  coverageRings: {
    within500Km: number;
    within1000Km: number;
    within1500Km: number;
    within2000Km: number;
  };
  nearestRangeKm: number | null;
  averageRangeKm: number | null;
}

export interface StarlinkFocusTrackPoint {
  minutesFromNow: number;
  latitude: number;
  longitude: number;
  altitudeKm: number;
}

export interface StarlinkFocusTrack {
  noradId: number;
  name: string;
  generatedAt: string;
  windowMinutes: number;
  intervalMinutes: number;
  points: StarlinkFocusTrackPoint[];
}

export interface StarlinkSourceInfo {
  provider: "CelesTrak";
  feed: "Starlink";
  url: string;
  fetchedAt: string;
  ageMs: number;
  stale: boolean;
}

export interface StarlinkSnapshot {
  generatedAt: string;
  source: StarlinkSourceInfo;
  satellites: StarlinkSatellitePoint[];
  metrics: StarlinkMetrics;
  userContext?: StarlinkUserContext;
  focusTrack?: StarlinkFocusTrack;
}

export interface StarlinkSnapshotOptions {
  lat?: number;
  lng?: number;
  limit?: number;
  focusNoradId?: number;
  viewport?: StarlinkViewportBounds;
  forceRefresh?: boolean;
}

export type StarlinkMapMode = "overview" | "regional" | "local";

export interface StarlinkMapView {
  generatedAt: string;
  source: StarlinkSourceInfo;
  animation: {
    leadSeconds: number;
  };
  view: {
    mode: StarlinkMapMode;
    zoom?: number;
    bounds?: StarlinkViewportBounds;
  };
  satellites: StarlinkSatellitePoint[];
  sampling: {
    strategy: "global-bucket" | "viewport-bucket" | "full-viewport";
    totalInViewport: number | null;
    returnedCount: number;
  };
}

export interface StarlinkObserverPass {
  noradId: number;
  name: string;
  riseAt: string;
  peakAt: string;
  setAt: string;
  maxElevationDeg: number;
}

export interface StarlinkObserverView {
  generatedAt: string;
  source: StarlinkSourceInfo;
  observer: {
    latitude: number;
    longitude: number;
  };
  visibleNow: StarlinkSatellitePoint[];
  nearest: StarlinkSatellitePoint[];
  nextPasses: StarlinkObserverPass[];
  summary: {
    visibleCount: number;
    nearestRangeKm: number | null;
  };
}

export interface StarlinkSatelliteDetail {
  generatedAt: string;
  source: StarlinkSourceInfo;
  satellite: StarlinkSatellitePoint;
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

interface ParsedStarlinkRecord {
  name: string;
  line1: string;
  line2: string;
  satrec: SatelliteRecord;
  noradId: number;
}

interface CachedStarlinkCatalog {
  records: ParsedStarlinkRecord[];
  fetchedAtMs: number;
  sourceUrl: string;
  stale: boolean;
}

interface CacheState {
  value?: CachedStarlinkCatalog;
  expiresAtMs: number;
  staleUntilMs: number;
  inflight?: Promise<CachedStarlinkCatalog>;
}

interface EarthFixedVector {
  x: number;
  y: number;
  z: number;
}

interface PropagatedStarlinkPoint extends StarlinkSatellitePoint {
  ecf: EarthFixedVector;
}

interface CachedPropagatedSnapshot {
  generatedAtMs: number;
  generatedAt: string;
  source: StarlinkSourceInfo;
  satellites: PropagatedStarlinkPoint[];
  metrics: StarlinkMetrics;
}

interface PropagationCacheState {
  value?: CachedPropagatedSnapshot;
  expiresAtMs: number;
  inflight?: Promise<CachedPropagatedSnapshot>;
}

type StarlinkGlobalScope = typeof globalThis & {
  __starlinkCacheState?: CacheState;
  __starlinkPropagationCacheState?: PropagationCacheState;
};

const globalScope = globalThis as StarlinkGlobalScope;

const cache: CacheState = globalScope.__starlinkCacheState ?? {
  expiresAtMs: 0,
  staleUntilMs: 0,
};

const propagationCache: PropagationCacheState =
  globalScope.__starlinkPropagationCacheState ?? {
    expiresAtMs: 0,
  };

globalScope.__starlinkCacheState = cache;
globalScope.__starlinkPropagationCacheState = propagationCache;

export class StarlinkDataError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, options?: { code?: string; status?: number; cause?: unknown }) {
    super(message);
    this.name = "StarlinkDataError";
    this.code = options?.code ?? "STARLINK_DATA_ERROR";
    this.status = options?.status ?? 502;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit ?? NaN)) {
    return DEFAULT_LIMIT;
  }

  const parsed = Math.trunc(limit as number);
  return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }

  if (typeof value === "string" && value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeLongitude(longitude: number): number {
  if (!Number.isFinite(longitude)) {
    return longitude;
  }

  let normalized = longitude % 360;
  if (normalized > 180) {
    normalized -= 360;
  } else if (normalized < -180) {
    normalized += 360;
  }

  return normalized;
}

function classifyShellBand(altitudeKm: number): StarlinkShellBand {
  if (altitudeKm < 450) {
    return "below-450km";
  }

  if (altitudeKm < 500) {
    return "450-500km";
  }

  if (altitudeKm < 550) {
    return "500-550km";
  }

  if (altitudeKm < 600) {
    return "550-600km";
  }

  return "600km-plus";
}

function buildObserver(lat: number, lng: number): GeodeticObserver {
  return {
    latitude: satellite.degreesToRadians(lat),
    longitude: satellite.degreesToRadians(lng),
    height: 0,
  };
}

interface SatelliteState {
  latitude: number;
  longitude: number;
  altitudeKm: number;
  speedKmPerSec: number;
}

interface SatelliteFrame extends SatelliteState {
  ecf: EarthFixedVector;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTleText(): Promise<{ text: string; fetchedAtMs: number; sourceUrl: string }> {
  let lastError: unknown;

  for (const sourceUrl of STARLINK_SOURCE_URLS) {
    for (let attempt = 0; attempt < FETCH_RETRY_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const response = await fetch(sourceUrl, {
          signal: controller.signal,
          headers: {
            accept: "text/plain",
            "user-agent": "Starlink-Live-Map/1.0 (+https://localhost)",
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new StarlinkDataError(`Starlink feed responded with ${response.status}`, {
            code: "STARLINK_FEED_HTTP_ERROR",
            status: 502,
          });
        }

        const text = await response.text();
        if (!text.trim()) {
          throw new StarlinkDataError("Starlink feed returned an empty TLE payload", {
            code: "STARLINK_FEED_EMPTY",
            status: 502,
          });
        }

        return {
          text,
          fetchedAtMs: Date.now(),
          sourceUrl,
        };
      } catch (error) {
        lastError = error;

        if (attempt + 1 < FETCH_RETRY_ATTEMPTS) {
          await sleep(FETCH_RETRY_DELAY_MS * (attempt + 1));
        }
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  if (lastError instanceof StarlinkDataError) {
    throw lastError;
  }

  throw new StarlinkDataError("Unable to fetch Starlink TLE feed", {
    code: "STARLINK_FEED_UNAVAILABLE",
    status: 502,
    cause: lastError,
  });
}

function parseTleText(text: string): ParsedStarlinkRecord[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  const records: ParsedStarlinkRecord[] = [];

  for (let index = 0; index + 2 < lines.length; index += 3) {
    const name = lines[index]?.trim();
    const line1 = lines[index + 1]?.trim();
    const line2 = lines[index + 2]?.trim();

    if (!name || !line1 || !line2 || !line1.startsWith("1 ") || !line2.startsWith("2 ")) {
      continue;
    }

    try {
      const satrec = satellite.twoline2satrec(line1, line2);
      const noradId = Number.parseInt(satrec.satnum, 10);

      if (!Number.isFinite(noradId)) {
        continue;
      }

      records.push({
        name,
        line1,
        line2,
        satrec,
        noradId,
      });
    } catch {
      continue;
    }
  }

  if (!records.length) {
    throw new StarlinkDataError("Starlink TLE feed did not contain any parseable satellites", {
      code: "STARLINK_FEED_PARSE_EMPTY",
      status: 502,
    });
  }

  return records;
}

function computeSatelliteFrame(
  record: ParsedStarlinkRecord,
  now: Date
): SatelliteFrame | null {
  const propagated = satellite.propagate(record.satrec, now);

  if (!propagated || !propagated.position || !propagated.velocity) {
    return null;
  }

  const gmst = satellite.gstime(now);
  const geodetic = satellite.eciToGeodetic(propagated.position, gmst);
  const ecf = satellite.eciToEcf(propagated.position, gmst);
  const speedKmPerSec = Math.sqrt(
    propagated.velocity.x ** 2 + propagated.velocity.y ** 2 + propagated.velocity.z ** 2
  );

  return {
    latitude: satellite.degreesLat(geodetic.latitude),
    longitude: normalizeLongitude(satellite.degreesLong(geodetic.longitude)),
    altitudeKm: geodetic.height,
    speedKmPerSec,
    ecf: {
      x: ecf.x,
      y: ecf.y,
      z: ecf.z,
    },
  };
}

function computeSatelliteState(
  record: ParsedStarlinkRecord,
  now: Date
): SatelliteState | null {
  const frame = computeSatelliteFrame(record, now);

  if (!frame) {
    return null;
  }

  return {
    latitude: frame.latitude,
    longitude: frame.longitude,
    altitudeKm: frame.altitudeKm,
    speedKmPerSec: frame.speedKmPerSec,
  };
}

function computeSatelliteMetadata(record: ParsedStarlinkRecord, now: Date) {
  const state = computeSatelliteFrame(record, now);
  const nextState = computeSatelliteFrame(
    record,
    new Date(now.getTime() + MOTION_LOOKAHEAD_SECONDS * 1000)
  );

  if (!state) {
    return null;
  }

  return {
    ...state,
    epoch: satellite.invjday(record.satrec.jdsatepoch).toISOString(),
    nextLatitude: nextState?.latitude ?? state.latitude,
    nextLongitude: nextState?.longitude ?? state.longitude,
    inclinationDeg: satellite.radiansToDegrees(record.satrec.inclo),
    raanDeg: satellite.radiansToDegrees(record.satrec.nodeo),
    argumentOfPerigeeDeg: satellite.radiansToDegrees(record.satrec.argpo),
    meanAnomalyDeg: satellite.radiansToDegrees(record.satrec.mo),
    meanMotionRevPerDay: record.satrec.no > 0 ? record.satrec.no * (1440 / (2 * Math.PI)) : 0,
    orbitalPeriodMinutes: record.satrec.no > 0 ? (2 * Math.PI) / record.satrec.no : 0,
    shellBand: classifyShellBand(state.altitudeKm),
    ecf: state.ecf,
  };
}

function buildFocusTrack(
  record: ParsedStarlinkRecord,
  referenceTime: Date
): StarlinkFocusTrack | null {
  const points: StarlinkFocusTrackPoint[] = [];

  for (
    let offsetMinutes = -FOCUS_TRACK_WINDOW_MINUTES;
    offsetMinutes <= FOCUS_TRACK_WINDOW_MINUTES;
    offsetMinutes += FOCUS_TRACK_INTERVAL_MINUTES
  ) {
    const sampleTime = new Date(referenceTime.getTime() + offsetMinutes * 60_000);
    const state = computeSatelliteState(record, sampleTime);

    if (!state) {
      continue;
    }

    points.push({
      minutesFromNow: offsetMinutes,
      latitude: state.latitude,
      longitude: state.longitude,
      altitudeKm: state.altitudeKm,
    });
  }

  if (!points.length) {
    return null;
  }

  return {
    noradId: record.noradId,
    name: record.name,
    generatedAt: referenceTime.toISOString(),
    windowMinutes: FOCUS_TRACK_WINDOW_MINUTES,
    intervalMinutes: FOCUS_TRACK_INTERVAL_MINUTES,
    points,
  };
}

async function readCatalog(forceRefresh = false): Promise<CachedStarlinkCatalog> {
  const now = Date.now();

  if (!forceRefresh && cache.value && now < cache.expiresAtMs) {
    return cache.value;
  }

  if (!forceRefresh && cache.inflight) {
    return cache.inflight;
  }

  const inflight = (async () => {
    const { text, fetchedAtMs, sourceUrl } = await fetchTleText();
    const records = parseTleText(text);

    const freshCatalog: CachedStarlinkCatalog = {
      records,
      fetchedAtMs,
      sourceUrl,
      stale: false,
    };

    cache.value = freshCatalog;
    cache.expiresAtMs = fetchedAtMs + CACHE_TTL_MS;
    cache.staleUntilMs = fetchedAtMs + STALE_TTL_MS;

    return freshCatalog;
  })();

  cache.inflight = inflight;

  try {
    return await inflight;
  } catch (error) {
    if (cache.value && now < cache.staleUntilMs) {
      const staleCatalog = {
        ...cache.value,
        stale: true,
      };

      cache.value = staleCatalog;
      return staleCatalog;
    }

    if (error instanceof StarlinkDataError) {
      throw error;
    }

    throw new StarlinkDataError("Unable to load the Starlink catalog", {
      code: "STARLINK_CATALOG_UNAVAILABLE",
      status: 502,
      cause: error,
    });
  } finally {
    if (cache.inflight === inflight) {
      cache.inflight = undefined;
    }
  }
}

async function readPropagatedSnapshot(forceRefresh = false): Promise<CachedPropagatedSnapshot> {
  const nowMs = Date.now();

  if (!forceRefresh && propagationCache.value && nowMs < propagationCache.expiresAtMs) {
    return propagationCache.value;
  }

  if (!forceRefresh && propagationCache.inflight) {
    return propagationCache.inflight;
  }

  const inflight = (async () => {
    const catalog = await readCatalog(forceRefresh);
    const now = new Date();
    const satellites = catalog.records
      .map((record) => buildPropagatedPoint(record, now))
      .filter((point): point is PropagatedStarlinkPoint => Boolean(point));

    const snapshot: CachedPropagatedSnapshot = {
      generatedAtMs: now.getTime(),
      generatedAt: now.toISOString(),
      source: buildSourceInfo(catalog),
      satellites,
      metrics: computeMetrics(satellites),
    };

    propagationCache.value = snapshot;
    propagationCache.expiresAtMs = now.getTime() + PROPAGATED_CACHE_TTL_MS;

    return snapshot;
  })();

  propagationCache.inflight = inflight;

  try {
    return await inflight;
  } finally {
    if (propagationCache.inflight === inflight) {
      propagationCache.inflight = undefined;
    }
  }
}

function computeSatellitePoint(
  record: ParsedStarlinkRecord,
  now: Date,
  observer?: GeodeticObserver
): StarlinkSatellitePoint | null {
  const state = computeSatelliteMetadata(record, now);

  if (!state) {
    return null;
  }

  const point: StarlinkSatellitePoint = {
    noradId: record.noradId,
    name: record.name,
    epoch: state.epoch,
    latitude: state.latitude,
    longitude: state.longitude,
    nextLatitude: state.nextLatitude,
    nextLongitude: state.nextLongitude,
    altitudeKm: state.altitudeKm,
    speedKmPerSec: state.speedKmPerSec,
    speedKph: state.speedKmPerSec * 3600,
    inclinationDeg: state.inclinationDeg,
    raanDeg: state.raanDeg,
    argumentOfPerigeeDeg: state.argumentOfPerigeeDeg,
    meanAnomalyDeg: state.meanAnomalyDeg,
    meanMotionRevPerDay: state.meanMotionRevPerDay,
    orbitalPeriodMinutes: state.orbitalPeriodMinutes,
    shellBand: state.shellBand,
  };

  if (observer) {
    const lookAngles = satellite.ecfToLookAngles(observer, state.ecf);

    point.rangeKm = lookAngles.rangeSat;
    point.azimuthDeg = satellite.radiansToDegrees(lookAngles.azimuth);
    point.elevationDeg = satellite.radiansToDegrees(lookAngles.elevation);
    point.aboveHorizon = lookAngles.elevation > 0;
  }

  return point;
}

function buildPropagatedPoint(record: ParsedStarlinkRecord, now: Date): PropagatedStarlinkPoint | null {
  const state = computeSatelliteMetadata(record, now);

  if (!state) {
    return null;
  }

  return {
    noradId: record.noradId,
    name: record.name,
    epoch: state.epoch,
    latitude: state.latitude,
    longitude: state.longitude,
    nextLatitude: state.nextLatitude,
    nextLongitude: state.nextLongitude,
    altitudeKm: state.altitudeKm,
    speedKmPerSec: state.speedKmPerSec,
    speedKph: state.speedKmPerSec * 3600,
    inclinationDeg: state.inclinationDeg,
    raanDeg: state.raanDeg,
    argumentOfPerigeeDeg: state.argumentOfPerigeeDeg,
    meanAnomalyDeg: state.meanAnomalyDeg,
    meanMotionRevPerDay: state.meanMotionRevPerDay,
    orbitalPeriodMinutes: state.orbitalPeriodMinutes,
    shellBand: state.shellBand,
    ecf: state.ecf,
  };
}

function enrichPointForObserver(
  point: PropagatedStarlinkPoint,
  observer: GeodeticObserver
): StarlinkSatellitePoint {
  const lookAngles = satellite.ecfToLookAngles(observer, point.ecf);

  return {
    noradId: point.noradId,
    name: point.name,
    epoch: point.epoch,
    latitude: point.latitude,
    longitude: point.longitude,
    nextLatitude: point.nextLatitude,
    nextLongitude: point.nextLongitude,
    altitudeKm: point.altitudeKm,
    speedKmPerSec: point.speedKmPerSec,
    speedKph: point.speedKph,
    inclinationDeg: point.inclinationDeg,
    raanDeg: point.raanDeg,
    argumentOfPerigeeDeg: point.argumentOfPerigeeDeg,
    meanAnomalyDeg: point.meanAnomalyDeg,
    meanMotionRevPerDay: point.meanMotionRevPerDay,
    orbitalPeriodMinutes: point.orbitalPeriodMinutes,
    shellBand: point.shellBand,
    rangeKm: lookAngles.rangeSat,
    azimuthDeg: satellite.radiansToDegrees(lookAngles.azimuth),
    elevationDeg: satellite.radiansToDegrees(lookAngles.elevation),
    aboveHorizon: lookAngles.elevation > 0,
  };
}

function toPublicPoint(point: PropagatedStarlinkPoint): StarlinkSatellitePoint {
  return {
    noradId: point.noradId,
    name: point.name,
    epoch: point.epoch,
    latitude: point.latitude,
    longitude: point.longitude,
    nextLatitude: point.nextLatitude,
    nextLongitude: point.nextLongitude,
    altitudeKm: point.altitudeKm,
    speedKmPerSec: point.speedKmPerSec,
    speedKph: point.speedKph,
    inclinationDeg: point.inclinationDeg,
    raanDeg: point.raanDeg,
    argumentOfPerigeeDeg: point.argumentOfPerigeeDeg,
    meanAnomalyDeg: point.meanAnomalyDeg,
    meanMotionRevPerDay: point.meanMotionRevPerDay,
    orbitalPeriodMinutes: point.orbitalPeriodMinutes,
    shellBand: point.shellBand,
  };
}

function computeMetrics(points: StarlinkSatellitePoint[]): StarlinkMetrics {
  const shellBreakdown: StarlinkMetrics["shellBreakdown"] = {
    "below-450km": 0,
    "450-500km": 0,
    "500-550km": 0,
    "550-600km": 0,
    "600km-plus": 0,
  };

  const hemisphereBreakdown: StarlinkMetrics["hemisphereBreakdown"] = {
    northern: 0,
    southern: 0,
    eastern: 0,
    western: 0,
    northeast: 0,
    northwest: 0,
    southeast: 0,
    southwest: 0,
  };

  let altitudeSum = 0;
  let speedSum = 0;

  for (const point of points) {
    shellBreakdown[point.shellBand] += 1;
    altitudeSum += point.altitudeKm;
    speedSum += point.speedKmPerSec;

    const northern = point.latitude >= 0;
    const eastern = point.longitude >= 0;

    if (northern) {
      hemisphereBreakdown.northern += 1;
    } else {
      hemisphereBreakdown.southern += 1;
    }

    if (eastern) {
      hemisphereBreakdown.eastern += 1;
    } else {
      hemisphereBreakdown.western += 1;
    }

    if (northern && eastern) {
      hemisphereBreakdown.northeast += 1;
    } else if (northern && !eastern) {
      hemisphereBreakdown.northwest += 1;
    } else if (!northern && eastern) {
      hemisphereBreakdown.southeast += 1;
    } else {
      hemisphereBreakdown.southwest += 1;
    }
  }

  if (points.length === 0) {
    return {
      totalCount: 0,
      averageAltitudeKm: 0,
      averageSpeedKmPerSec: 0,
      shellBreakdown,
      hemisphereBreakdown,
    };
  }

  return {
    totalCount: points.length,
    averageAltitudeKm: altitudeSum / points.length,
    averageSpeedKmPerSec: speedSum / points.length,
    shellBreakdown,
    hemisphereBreakdown,
  };
}

function buildUserContext(
  points: StarlinkSatellitePoint[],
  observerLocation: { latitude: number; longitude: number }
): StarlinkUserContext {
  const ranked = points
    .filter((point) => typeof point.rangeKm === "number")
    .sort(compareObserverRelevance);

  const visibleSatellites = ranked
    .filter((point) => point.aboveHorizon)
    .slice(0, DEFAULT_NEAREST_LIMIT);
  const nearestSatellites = ranked.slice(0, DEFAULT_NEAREST_LIMIT);
  const visibleCount = ranked.filter((point) => point.aboveHorizon).length;
  const averageRangeKm =
    ranked.length > 0
      ? ranked.reduce((total, point) => total + (point.rangeKm ?? 0), 0) / ranked.length
      : null;

  return {
    observer: {
      latitude: observerLocation.latitude,
      longitude: observerLocation.longitude,
    },
    visibleSatellites,
    nearestSatellites,
    visibleCount,
    coverageRings: {
      within500Km: ranked.filter((point) => (point.rangeKm ?? Infinity) <= 500).length,
      within1000Km: ranked.filter((point) => (point.rangeKm ?? Infinity) <= 1000).length,
      within1500Km: ranked.filter((point) => (point.rangeKm ?? Infinity) <= 1500).length,
      within2000Km: ranked.filter((point) => (point.rangeKm ?? Infinity) <= 2000).length,
    },
    nearestRangeKm: nearestSatellites[0]?.rangeKm ?? null,
    averageRangeKm,
  };
}

function buildSourceInfo(catalog: CachedStarlinkCatalog): StarlinkSourceInfo {
  const now = Date.now();

  return {
    provider: "CelesTrak",
    feed: "Starlink",
    url: catalog.sourceUrl ?? STARLINK_SOURCE_URL,
    fetchedAt: new Date(catalog.fetchedAtMs).toISOString(),
    ageMs: Math.max(0, now - catalog.fetchedAtMs),
    stale: catalog.stale,
  };
}

function compareMapPosition(left: StarlinkSatellitePoint, right: StarlinkSatellitePoint) {
  const longitudeDelta = left.longitude - right.longitude;
  if (longitudeDelta !== 0) {
    return longitudeDelta;
  }

  const latitudeDelta = left.latitude - right.latitude;
  if (latitudeDelta !== 0) {
    return latitudeDelta;
  }

  return left.noradId - right.noradId;
}

function compareObserverRelevance(left: StarlinkSatellitePoint, right: StarlinkSatellitePoint) {
  const leftVisible = left.aboveHorizon ? 1 : 0;
  const rightVisible = right.aboveHorizon ? 1 : 0;

  if (leftVisible !== rightVisible) {
    return rightVisible - leftVisible;
  }

  const leftElevation = left.elevationDeg ?? -90;
  const rightElevation = right.elevationDeg ?? -90;
  if (leftElevation !== rightElevation) {
    return rightElevation - leftElevation;
  }

  const leftRange = left.rangeKm ?? Infinity;
  const rightRange = right.rangeKm ?? Infinity;
  if (leftRange !== rightRange) {
    return leftRange - rightRange;
  }

  return compareMapPosition(left, right);
}

function getViewportLongitudeSpan(viewport: StarlinkViewportBounds) {
  const west = normalizeLongitude(viewport.west);
  const east = normalizeLongitude(viewport.east);

  if (east >= west) {
    return east - west;
  }

  return 360 - (west - east);
}

function getViewportLongitudeFraction(longitude: number, viewport: StarlinkViewportBounds) {
  const west = normalizeLongitude(viewport.west);
  const span = getViewportLongitudeSpan(viewport);

  if (span <= 0) {
    return 0;
  }

  let offset = normalizeLongitude(longitude) - west;
  if (offset < 0) {
    offset += 360;
  }

  return Math.max(0, Math.min(1, offset / span));
}

function buildBucketKey(
  point: StarlinkSatellitePoint,
  rows: number,
  columns: number,
  viewport?: StarlinkViewportBounds
) {
  const latitudeFraction = viewport
    ? viewport.north === viewport.south
      ? 0
      : (point.latitude - viewport.south) / (viewport.north - viewport.south)
    : (point.latitude + 90) / 180;
  const longitudeFraction = viewport
    ? getViewportLongitudeFraction(point.longitude, viewport)
    : (point.longitude + 180) / 360;

  const row = Math.max(0, Math.min(rows - 1, Math.floor(latitudeFraction * rows)));
  const column = Math.max(0, Math.min(columns - 1, Math.floor(longitudeFraction * columns)));

  return `${row}:${column}`;
}

function compareBucketKey(left: string, right: string) {
  const [leftRow, leftColumn] = left.split(":").map(Number);
  const [rightRow, rightColumn] = right.split(":").map(Number);

  if (leftRow !== rightRow) {
    return leftRow - rightRow;
  }

  return leftColumn - rightColumn;
}

function isPointInViewport(point: StarlinkSatellitePoint, viewport: StarlinkViewportBounds) {
  if (point.latitude < viewport.south || point.latitude > viewport.north) {
    return false;
  }

  const longitude = normalizeLongitude(point.longitude);
  const west = normalizeLongitude(viewport.west);
  const east = normalizeLongitude(viewport.east);

  if (east >= west) {
    return longitude >= west && longitude <= east;
  }

  return longitude >= west || longitude <= east;
}

function sortByRangeThenPosition(left: StarlinkSatellitePoint, right: StarlinkSatellitePoint) {
  const leftRange = left.rangeKm ?? Infinity;
  const rightRange = right.rangeKm ?? Infinity;
  if (leftRange !== rightRange) {
    return leftRange - rightRange;
  }

  return compareMapPosition(left, right);
}

function selectBucketedSatellites(
  satellites: StarlinkSatellitePoint[],
  limit: number,
  rows: number,
  columns: number,
  focusNoradId?: number,
  viewport?: StarlinkViewportBounds
) {
  const sorted = satellites.slice().sort(compareMapPosition);
  const focusSatellite =
    typeof focusNoradId === "number"
      ? sorted.find((satellite) => satellite.noradId === focusNoradId)
      : undefined;

  if (sorted.length <= limit) {
    return sorted;
  }

  const buckets = new Map<string, StarlinkSatellitePoint[]>();

  for (const satellite of sorted) {
    const key = buildBucketKey(satellite, rows, columns, viewport);
    const bucket = buckets.get(key);

    if (bucket) {
      bucket.push(satellite);
      continue;
    }

    buckets.set(key, [satellite]);
  }

  const orderedBuckets = Array.from(buckets.entries())
    .sort(([leftKey], [rightKey]) => compareBucketKey(leftKey, rightKey))
    .map(([, bucket]) => ({
      satellites: bucket,
      cursor: 0,
    }));

  const selected: StarlinkSatellitePoint[] = [];
  const seen = new Set<number>();

  if (focusSatellite) {
    selected.push(focusSatellite);
    seen.add(focusSatellite.noradId);
  }

  while (selected.length < limit) {
    let addedAny = false;

    for (const bucket of orderedBuckets) {
      while (
        bucket.cursor < bucket.satellites.length &&
        seen.has(bucket.satellites[bucket.cursor].noradId)
      ) {
        bucket.cursor += 1;
      }

      if (bucket.cursor >= bucket.satellites.length) {
        continue;
      }

      const satellite = bucket.satellites[bucket.cursor];
      bucket.cursor += 1;
      selected.push(satellite);
      seen.add(satellite.noradId);
      addedAny = true;

      if (selected.length >= limit) {
        break;
      }
    }

    if (!addedAny) {
      break;
    }
  }

  return selected.sort(compareMapPosition);
}

function selectSatellitesForMap(
  satellites: StarlinkSatellitePoint[],
  limit: number,
  options: {
    focusNoradId?: number;
    observer?: GeodeticObserver;
    viewport?: StarlinkViewportBounds;
  } = {}
) {
  const sorted = satellites.slice().sort(compareMapPosition);
  const selected: StarlinkSatellitePoint[] = [];
  const seen = new Set<number>();
  const focusSatellite =
    typeof options.focusNoradId === "number"
      ? sorted.find((satellite) => satellite.noradId === options.focusNoradId)
      : undefined;

  if (focusSatellite) {
    selected.push(focusSatellite);
    seen.add(focusSatellite.noradId);
  }

  const remaining = sorted.filter((satellite) => !seen.has(satellite.noradId));
  let remainingLimit = Math.max(0, limit - selected.length);

  if (remainingLimit === 0) {
    return selected.sort(compareMapPosition);
  }

  if (options.viewport) {
    const viewportSatellites = remaining.filter((satellite) =>
      isPointInViewport(satellite, options.viewport as StarlinkViewportBounds)
    );

    if (viewportSatellites.length > 0) {
      if (options.observer) {
        const observerPriorityLimit = Math.min(
          remainingLimit,
          Math.min(32, Math.max(DEFAULT_NEAREST_LIMIT, Math.ceil(limit * 0.05)))
        );
        const observerRelevant = viewportSatellites
          .filter(
            (satellite) =>
              (satellite.aboveHorizon ?? false) ||
              (satellite.rangeKm ?? Infinity) <= 2500
          )
          .sort(compareObserverRelevance)
          .slice(0, observerPriorityLimit);

        for (const satellite of observerRelevant) {
          if (seen.has(satellite.noradId)) {
            continue;
          }

          selected.push(satellite);
          seen.add(satellite.noradId);
        }

        remainingLimit = Math.max(0, limit - selected.length);
      }

      const viewportRemaining = viewportSatellites.filter((satellite) => !seen.has(satellite.noradId));
      const viewportSelected =
        viewportRemaining.length <= remainingLimit
          ? viewportRemaining
          : selectBucketedSatellites(
              viewportRemaining,
              remainingLimit,
              LOCAL_MAP_BUCKET_ROWS,
              LOCAL_MAP_BUCKET_COLUMNS,
              undefined,
              options.viewport
            );

      for (const satellite of viewportSelected) {
        if (seen.has(satellite.noradId)) {
          continue;
        }

        selected.push(satellite);
        seen.add(satellite.noradId);
      }

      remainingLimit = Math.max(0, limit - selected.length);
    }
  }

  if (remainingLimit > 0 && options.observer) {
    const localSatellites = remaining.filter(
      (satellite) =>
        !seen.has(satellite.noradId) &&
        ((satellite.aboveHorizon ?? false) || (satellite.rangeKm ?? Infinity) <= 2000)
    );

    if (localSatellites.length > 0) {
      const localSelected =
        localSatellites.length <= remainingLimit
          ? localSatellites.sort(compareObserverRelevance)
          : localSatellites.sort(compareObserverRelevance).slice(0, remainingLimit);

      for (const satellite of localSelected) {
        if (seen.has(satellite.noradId)) {
          continue;
        }

        selected.push(satellite);
        seen.add(satellite.noradId);
      }

      remainingLimit = Math.max(0, limit - selected.length);
    }
  }

  if (remainingLimit > 0) {
    const fallbackSatellites = remaining.filter((satellite) => !seen.has(satellite.noradId));
    const fallbackSelected = selectBucketedSatellites(
      fallbackSatellites,
      remainingLimit,
      GLOBAL_MAP_BUCKET_ROWS,
      GLOBAL_MAP_BUCKET_COLUMNS,
      options.focusNoradId
    );

    for (const satellite of fallbackSelected) {
      if (seen.has(satellite.noradId)) {
        continue;
      }

      selected.push(satellite);
      seen.add(satellite.noradId);
    }
  }

  return selected.sort(compareMapPosition);
}

function resolveMapMode(viewport?: StarlinkViewportBounds, zoom?: number): StarlinkMapMode {
  if (!viewport || zoom === undefined) {
    return "overview";
  }

  if (zoom >= 8) {
    return "local";
  }

  if (zoom >= 4) {
    return "regional";
  }

  return "overview";
}

function buildDetailedTrack(
  record: ParsedStarlinkRecord,
  referenceTime: Date
): StarlinkSatelliteDetail["track"] {
  const points: StarlinkSatelliteDetail["track"] = [];

  for (let offsetSeconds = -45 * 60; offsetSeconds <= 45 * 60; offsetSeconds += 30) {
    const sampleTime = new Date(referenceTime.getTime() + offsetSeconds * 1000);
    const state = computeSatelliteState(record, sampleTime);

    if (!state) {
      continue;
    }

    points.push({
      timeOffsetSec: offsetSeconds,
      latitude: state.latitude,
      longitude: state.longitude,
      altitudeKm: state.altitudeKm,
    });
  }

  return points;
}

function buildObserverPasses(
  catalog: CachedStarlinkCatalog,
  observer: GeodeticObserver,
  referenceTime: Date,
  rankedCandidates: StarlinkSatellitePoint[]
): StarlinkObserverPass[] {
  const passes: StarlinkObserverPass[] = [];
  const candidates = rankedCandidates.slice(0, 12);

  for (const candidate of candidates) {
    const record = catalog.records.find((entry) => entry.noradId === candidate.noradId);
    if (!record) {
      continue;
    }

    let riseAt: Date | null = null;
    let peakAt: Date | null = null;
    let setAt: Date | null = null;
    let maxElevationDeg = -90;
    let previousAboveHorizon = candidate.aboveHorizon ?? false;

    for (
      let offsetSeconds = 0;
      offsetSeconds <= NEXT_PASS_WINDOW_MINUTES * 60;
      offsetSeconds += NEXT_PASS_STEP_SECONDS
    ) {
      const sampleTime = new Date(referenceTime.getTime() + offsetSeconds * 1000);
      const point = computeSatellitePoint(record, sampleTime, observer);

      if (!point || typeof point.elevationDeg !== "number") {
        continue;
      }

      const aboveHorizon = point.elevationDeg > 0;
      if (!riseAt && aboveHorizon && !previousAboveHorizon) {
        riseAt = sampleTime;
      }

      if (aboveHorizon && point.elevationDeg > maxElevationDeg) {
        maxElevationDeg = point.elevationDeg;
        peakAt = sampleTime;
      }

      if (riseAt && previousAboveHorizon && !aboveHorizon) {
        setAt = sampleTime;
        break;
      }

      previousAboveHorizon = aboveHorizon;
    }

    if (riseAt && peakAt && setAt && maxElevationDeg > 0) {
      passes.push({
        noradId: candidate.noradId,
        name: candidate.name,
        riseAt: riseAt.toISOString(),
        peakAt: peakAt.toISOString(),
        setAt: setAt.toISOString(),
        maxElevationDeg,
      });
    }
  }

  return passes
    .sort((left, right) => left.riseAt.localeCompare(right.riseAt))
    .slice(0, DEFAULT_NEAREST_LIMIT);
}

export async function getStarlinkMapView(options: {
  limit?: number;
  focusNoradId?: number;
  viewport?: StarlinkViewportBounds;
  zoom?: number;
  mode?: StarlinkMapMode;
  lat?: number;
  lng?: number;
  forceRefresh?: boolean;
} = {}): Promise<StarlinkMapView> {
  const limit = clampLimit(options.limit);
  const observer =
    typeof options.lat === "number" && typeof options.lng === "number"
      ? buildObserver(options.lat, options.lng)
      : undefined;
  const propagated = await readPropagatedSnapshot(options.forceRefresh ?? false);
  const visiblePoints = observer
    ? propagated.satellites.map((point) => enrichPointForObserver(point, observer))
    : propagated.satellites.map(toPublicPoint);
  const mode = options.mode ?? resolveMapMode(options.viewport, options.zoom);
  const totalInViewport = options.viewport
    ? visiblePoints.filter((point) => isPointInViewport(point, options.viewport as StarlinkViewportBounds))
        .length
    : null;

  const satellites = selectSatellitesForMap(visiblePoints, limit, {
    focusNoradId: options.focusNoradId,
    observer,
    viewport: options.viewport,
  });

  return {
    generatedAt: propagated.generatedAt,
    source: propagated.source,
    animation: {
      leadSeconds: MOTION_LOOKAHEAD_SECONDS,
    },
    view: {
      mode,
      zoom: options.zoom,
      bounds: options.viewport,
    },
    satellites,
    sampling: {
      strategy:
        options.viewport && totalInViewport !== null && totalInViewport <= limit
          ? "full-viewport"
          : options.viewport
            ? "viewport-bucket"
            : "global-bucket",
      totalInViewport,
      returnedCount: satellites.length,
    },
  };
}

export async function getStarlinkObserverView(options: {
  lat: number;
  lng: number;
  forceRefresh?: boolean;
}): Promise<StarlinkObserverView> {
  const observer = buildObserver(options.lat, options.lng);
  const [catalog, propagated] = await Promise.all([
    readCatalog(options.forceRefresh ?? false),
    readPropagatedSnapshot(options.forceRefresh ?? false),
  ]);
  const observerPoints = propagated.satellites
    .map((point) => enrichPointForObserver(point, observer))
    .sort(compareObserverRelevance);
  const visiblePoints = observerPoints.filter((point) => point.aboveHorizon);
  const visibleNow = visiblePoints.slice(0, DEFAULT_NEAREST_LIMIT);
  const nearest = observerPoints.slice(0, DEFAULT_NEAREST_LIMIT);

  return {
    generatedAt: propagated.generatedAt,
    source: propagated.source,
    observer: {
      latitude: options.lat,
      longitude: options.lng,
    },
    visibleNow,
    nearest,
    nextPasses: buildObserverPasses(catalog, observer, new Date(propagated.generatedAtMs), nearest),
    summary: {
      visibleCount: visiblePoints.length,
      nearestRangeKm: nearest[0]?.rangeKm ?? null,
    },
  };
}

export async function getStarlinkSatelliteDetail(options: {
  noradId: number;
  lat?: number;
  lng?: number;
  forceRefresh?: boolean;
}): Promise<StarlinkSatelliteDetail> {
  const [catalog, propagated] = await Promise.all([
    readCatalog(options.forceRefresh ?? false),
    readPropagatedSnapshot(options.forceRefresh ?? false),
  ]);
  const record = catalog.records.find((entry) => entry.noradId === options.noradId);

  if (!record) {
    throw new StarlinkDataError(`No Starlink satellite found for NORAD ${options.noradId}`, {
      code: "STARLINK_SATELLITE_NOT_FOUND",
      status: 404,
    });
  }

  const basePoint = propagated.satellites.find((entry) => entry.noradId === options.noradId);
  if (!basePoint) {
    throw new StarlinkDataError(`Satellite ${options.noradId} could not be propagated`, {
      code: "STARLINK_SATELLITE_UNAVAILABLE",
      status: 404,
    });
  }

  const observer =
    typeof options.lat === "number" && typeof options.lng === "number"
      ? buildObserver(options.lat, options.lng)
      : undefined;
  const satellitePoint = observer ? enrichPointForObserver(basePoint, observer) : toPublicPoint(basePoint);

  return {
    generatedAt: propagated.generatedAt,
    source: propagated.source,
    satellite: satellitePoint,
    track: buildDetailedTrack(record, new Date(propagated.generatedAtMs)),
    observerRelation: observer
      ? {
          rangeKm: satellitePoint.rangeKm ?? null,
          azimuthDeg: satellitePoint.azimuthDeg ?? null,
          elevationDeg: satellitePoint.elevationDeg ?? null,
          aboveHorizon: satellitePoint.aboveHorizon ?? false,
        }
      : undefined,
  };
}

export async function getStarlinkSnapshot(
  options: StarlinkSnapshotOptions = {}
): Promise<StarlinkSnapshot> {
  const limit = clampLimit(options.limit);
  const observer =
    typeof options.lat === "number" && typeof options.lng === "number"
      ? buildObserver(options.lat, options.lng)
      : undefined;

  const [catalog, propagated] = await Promise.all([
    readCatalog(options.forceRefresh ?? false),
    readPropagatedSnapshot(options.forceRefresh ?? false),
  ]);
  const now = new Date(propagated.generatedAtMs);
  const focusRecord =
    typeof options.focusNoradId === "number"
      ? catalog.records.find((record) => record.noradId === options.focusNoradId)
      : undefined;

  const computed = observer
    ? propagated.satellites.map((point) => enrichPointForObserver(point, observer))
    : propagated.satellites.map(toPublicPoint);

  const satellites = selectSatellitesForMap(computed, limit, {
    focusNoradId: options.focusNoradId,
    observer,
    viewport: options.viewport,
  });
  const metrics = propagated.metrics;
  const userContext = observer
    ? buildUserContext(computed, {
        latitude: options.lat as number,
        longitude: options.lng as number,
      })
    : undefined;
  const focusTrack = focusRecord ? buildFocusTrack(focusRecord, now) : undefined;

  return {
    generatedAt: propagated.generatedAt,
    source: propagated.source,
    satellites,
    metrics,
    userContext,
    focusTrack: focusTrack ?? undefined,
  };
}

export function parseStarlinkQueryCoordinate(value: string | null): number | undefined {
  return toFiniteNumber(value);
}

export function parseStarlinkQueryLimit(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }

  const parsed = toFiniteNumber(value);
  if (parsed === undefined) {
    throw new StarlinkDataError("limit must be a positive integer", {
      code: "STARLINK_LIMIT_INVALID",
      status: 400,
    });
  }

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new StarlinkDataError("limit must be a positive integer", {
      code: "STARLINK_LIMIT_INVALID",
      status: 400,
    });
  }

  return parsed;
}

export function parseStarlinkQueryFocusNoradId(value: string | null): number | undefined {
  const parsed = toFiniteNumber(value);

  if (parsed === undefined || !Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

export function parseStarlinkQueryZoom(value: string | null): number | undefined {
  const parsed = toFiniteNumber(value);

  if (parsed === undefined) {
    return undefined;
  }

  return parsed;
}

export function parseStarlinkMapMode(value: string | null): StarlinkMapMode | undefined {
  if (value === null) {
    return undefined;
  }

  if (value === "overview" || value === "regional" || value === "local") {
    return value;
  }

  throw new StarlinkDataError("mode must be overview, regional, or local", {
    code: "STARLINK_MODE_INVALID",
    status: 400,
  });
}

export function validateStarlinkCoordinates(lat: number | undefined, lng: number | undefined): {
  latitude: number;
  longitude: number;
} {
  if (lat === undefined || lng === undefined) {
    throw new StarlinkDataError("lat and lng must be provided together", {
      code: "STARLINK_COORDINATES_REQUIRED",
      status: 400,
    });
  }

  if (lat < -90 || lat > 90) {
    throw new StarlinkDataError("lat must be between -90 and 90", {
      code: "STARLINK_LAT_OUT_OF_RANGE",
      status: 400,
    });
  }

  if (lng < -180 || lng > 180) {
    throw new StarlinkDataError("lng must be between -180 and 180", {
      code: "STARLINK_LNG_OUT_OF_RANGE",
      status: 400,
    });
  }

  return {
    latitude: lat,
    longitude: lng,
  };
}

export function validateStarlinkViewport(
  north: number | undefined,
  south: number | undefined,
  east: number | undefined,
  west: number | undefined
): StarlinkViewportBounds {
  if (north === undefined || south === undefined || east === undefined || west === undefined) {
    throw new StarlinkDataError("north, south, east, and west must be provided together", {
      code: "STARLINK_VIEWPORT_REQUIRED",
      status: 400,
    });
  }

  const resolvedNorth = north;
  const resolvedSouth = south;
  const resolvedEast = east;
  const resolvedWest = west;

  if (resolvedSouth > resolvedNorth) {
    throw new StarlinkDataError("south must be less than or equal to north", {
      code: "STARLINK_VIEWPORT_LAT_INVALID",
      status: 400,
    });
  }

  if (
    resolvedNorth < -90 ||
    resolvedNorth > 90 ||
    resolvedSouth < -90 ||
    resolvedSouth > 90
  ) {
    throw new StarlinkDataError("viewport latitude bounds must be between -90 and 90", {
      code: "STARLINK_VIEWPORT_LAT_OUT_OF_RANGE",
      status: 400,
    });
  }

  if (
    resolvedEast < -180 ||
    resolvedEast > 180 ||
    resolvedWest < -180 ||
    resolvedWest > 180
  ) {
    throw new StarlinkDataError("viewport longitude bounds must be between -180 and 180", {
      code: "STARLINK_VIEWPORT_LNG_OUT_OF_RANGE",
      status: 400,
    });
  }

  return {
    north: resolvedNorth,
    south: resolvedSouth,
    east: resolvedEast,
    west: resolvedWest,
  };
}

export function clampStarlinkLimit(limit: number | undefined): number {
  return clampLimit(limit);
}
