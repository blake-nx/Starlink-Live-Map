"use client";

import { LocateFixed } from "lucide-react";
import maplibregl, {
  type LngLatBounds,
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";

export interface ConstellationMapProps {
  satellites: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    nextLat?: number | null;
    nextLng?: number | null;
    altitudeKm: number;
    velocityKps: number;
  }>;
  generatedAt: string;
  motionLeadSeconds?: number;
  selectedSatelliteId?: string | null;
  onSelect?: (satelliteId: string | null) => void;
  userLocation?: { lat: number; lng: number } | null;
  userLocationStatus?: "idle" | "locating" | "ready" | "denied" | "unsupported" | "error";
  onLocateUser?: () => void;
  status?: "idle" | "loading" | "ready" | "error";
  focusTrack?: Array<{
    lat: number;
    lng: number;
    minutesFromNow: number;
  }>;
  onViewportChange?: (viewport: ConstellationViewport) => void;
  className?: string;
}

export interface ConstellationViewport {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
  centerLat: number;
  centerLng: number;
}

type ProjectedSatellite = ConstellationMapProps["satellites"][number] & {
  x: number;
  y: number;
  nextX: number;
  nextY: number;
  radius: number;
  hitRadius: number;
};

type ClusteredPoint = {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  count: number;
};

type RenderTier = "global" | "regional" | "local";

type SceneState = {
  signature: string;
  tier: RenderTier;
  zoom: number;
  projectedSatellites: ProjectedSatellite[];
  clusters: ClusteredPoint[];
  selectedProjected: { x: number; y: number; nextX: number; nextY: number; radius: number } | null;
  userProjected: { x: number; y: number } | null;
  focusTrackProjected: Array<{ x: number; y: number; minutesFromNow: number }> | null;
};

const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    cartoBase: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    {
      id: "fallback-background",
      type: "background",
      paint: {
        "background-color": "#020817",
      },
    },
    {
      id: "carto-base",
      type: "raster",
      source: "cartoBase",
      minzoom: 0,
      maxzoom: 20,
      paint: {
        "raster-saturation": -0.88,
        "raster-contrast": 0.34,
        "raster-brightness-min": 0.07,
        "raster-brightness-max": 0.5,
        "raster-fade-duration": 0,
      },
    },
  ],
};

const DEFAULT_CENTER: [number, number] = [-98.5795, 39.8283];
const DEFAULT_ZOOM = 3.6;
const MIN_ZOOM = 1.05;
const MAX_ZOOM = 18.5;
const USER_FOCUS_ZOOM = 8.5;
const VIEWPORT_EMIT_DEBOUNCE_MS = 120;
const HIT_PADDING_PX = 20;

function normalizeLongitude(longitude: number) {
  return ((longitude + 180) % 360 + 360) % 360 - 180;
}

function wrapLongitudeToAnchor(longitude: number, anchorLongitude: number) {
  const normalized = normalizeLongitude(longitude);
  let candidate = normalized;

  while (candidate - anchorLongitude > 180) {
    candidate -= 360;
  }

  while (candidate - anchorLongitude < -180) {
    candidate += 360;
  }

  return candidate;
}

function buildViewport(bounds: LngLatBounds, map: MapLibreMap): ConstellationViewport {
  const center = map.getCenter();

  return {
    west: normalizeLongitude(bounds.getWest()),
    south: Math.max(-90, Math.min(90, bounds.getSouth())),
    east: normalizeLongitude(bounds.getEast()),
    north: Math.max(-90, Math.min(90, bounds.getNorth())),
    zoom: map.getZoom(),
    centerLat: center.lat,
    centerLng: normalizeLongitude(center.lng),
  };
}

function clamp(min: number, value: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function interpolateValue(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function getBaseRadius(zoom: number) {
  if (zoom < 2.6) {
    return 1.6;
  }

  if (zoom < 4.5) {
    return 2.05;
  }

  if (zoom < 7) {
    return 2.6;
  }

  if (zoom < 10) {
    return 3.3;
  }

  return 4.5;
}

function getRenderTier(zoom: number): RenderTier {
  if (zoom < 3.75) {
    return "global";
  }

  if (zoom < 7.5) {
    return "regional";
  }

  return "local";
}

function buildProjectedSatellites(
  map: MapLibreMap,
  satellites: ConstellationMapProps["satellites"]
): ProjectedSatellite[] {
  const zoom = map.getZoom();
  const centerLng = normalizeLongitude(map.getCenter().lng);
  const bounds = map.getBounds();
  const minX = -HIT_PADDING_PX;
  const minY = -HIT_PADDING_PX;
  const maxX = map.getContainer().clientWidth + HIT_PADDING_PX;
  const maxY = map.getContainer().clientHeight + HIT_PADDING_PX;
  const baseRadius = getBaseRadius(zoom);

  return satellites
    .filter((satellite) => satellite.lat <= bounds.getNorth() + 25 && satellite.lat >= bounds.getSouth() - 25)
    .map((satellite) => {
      const wrappedLongitude = wrapLongitudeToAnchor(satellite.lng, centerLng);
      const nextLongitude = wrapLongitudeToAnchor(
        satellite.nextLng ?? satellite.lng,
        wrappedLongitude
      );
      const projected = map.project([wrappedLongitude, satellite.lat]);
      const nextProjected = map.project([
        nextLongitude,
        satellite.nextLat ?? satellite.lat,
      ]);
      const radius = baseRadius + clamp(0, (satellite.altitudeKm - 340) / 220, 1.6);

      return {
        ...satellite,
        x: projected.x,
        y: projected.y,
        nextX: nextProjected.x,
        nextY: nextProjected.y,
        radius,
        hitRadius: Math.max(10, radius + 8),
      };
    })
    .filter(
      (satellite) =>
        satellite.x >= minX &&
        satellite.x <= maxX &&
        satellite.y >= minY &&
        satellite.y <= maxY
    );
}

function buildClusteredPoints(projected: ProjectedSatellite[], zoom: number): ClusteredPoint[] {
  const cellSize = zoom < 2.2 ? 48 : zoom < 3.6 ? 34 : zoom < 5.8 ? 20 : 12;
  const cells = new Map<string, ClusteredPoint>();

  for (const satellite of projected) {
    const column = Math.floor(satellite.x / cellSize);
    const row = Math.floor(satellite.y / cellSize);
    const key = `${column}:${row}`;
    const existing = cells.get(key);

    if (existing) {
      existing.x += satellite.x;
      existing.y += satellite.y;
      existing.count += 1;
      existing.intensity = Math.max(existing.intensity, satellite.radius);
      continue;
    }

    cells.set(key, {
      x: satellite.x,
      y: satellite.y,
      radius: satellite.radius,
      intensity: satellite.radius,
      count: 1,
    });
  }

  return Array.from(cells.values()).map((cluster) => ({
    ...cluster,
    x: cluster.x / cluster.count,
    y: cluster.y / cluster.count,
    radius:
      cluster.radius +
      Math.log2(cluster.count + 1) * (zoom < 3.75 ? 1.55 : 1.25),
  }));
}

function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number
) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${color}, ${alpha})`);
  gradient.addColorStop(0.35, `rgba(${color}, ${alpha * 0.55})`);
  gradient.addColorStop(1, `rgba(${color}, 0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function findNearestSatellite(
  projectedSatellites: ProjectedSatellite[],
  x: number,
  y: number
) {
  let nearest: ProjectedSatellite | null = null;
  let bestDistanceSquared = Infinity;

  for (const satellite of projectedSatellites) {
    const dx = satellite.x - x;
    const dy = satellite.y - y;
    const distanceSquared = dx * dx + dy * dy;
    const limit = satellite.hitRadius * satellite.hitRadius;

    if (distanceSquared > limit || distanceSquared >= bestDistanceSquared) {
      continue;
    }

    nearest = satellite;
    bestDistanceSquared = distanceSquared;
  }

  return nearest;
}

function getSceneSignature(
  map: MapLibreMap,
  satellites: ConstellationMapProps["satellites"],
  selectedSatellite: ConstellationMapProps["satellites"][number] | null,
  userLocation: { lat: number; lng: number } | null,
  focusTrack: ConstellationMapProps["focusTrack"]
) {
  const zoom = map.getZoom();
  const center = map.getCenter();
  const container = map.getContainer();

  return [
    getRenderTier(zoom),
    zoom.toFixed(2),
    center.lat.toFixed(4),
    center.lng.toFixed(4),
    container.clientWidth,
    container.clientHeight,
    satellites.length,
    selectedSatellite?.id ?? "none",
    userLocation ? `${userLocation.lat.toFixed(4)},${userLocation.lng.toFixed(4)}` : "none",
    focusTrack?.length ?? 0,
  ].join("|");
}

function buildSceneState(
  map: MapLibreMap,
  satellites: ConstellationMapProps["satellites"],
  selectedSatellite: ConstellationMapProps["satellites"][number] | null,
  userLocation: { lat: number; lng: number } | null,
  focusTrack: ConstellationMapProps["focusTrack"]
): SceneState {
  const zoom = map.getZoom();
  const tier = getRenderTier(zoom);
  const centerLng = normalizeLongitude(map.getCenter().lng);
  const container = map.getContainer();
  const projectedSatellites = buildProjectedSatellites(map, satellites);
  const clusters = tier === "global" || tier === "regional" ? buildClusteredPoints(projectedSatellites, zoom) : [];

  const selectedProjected = selectedSatellite
    ? (() => {
        const projected = map.project([
          wrapLongitudeToAnchor(selectedSatellite.lng, centerLng),
          selectedSatellite.lat,
        ]);
        const nextProjected = map.project([
          wrapLongitudeToAnchor(
            selectedSatellite.nextLng ?? selectedSatellite.lng,
            wrapLongitudeToAnchor(selectedSatellite.lng, centerLng)
          ),
          selectedSatellite.nextLat ?? selectedSatellite.lat,
        ]);

        return {
          x: projected.x,
          y: projected.y,
          nextX: nextProjected.x,
          nextY: nextProjected.y,
          radius: getBaseRadius(zoom) + 2.4,
        };
      })()
    : null;

  const userProjected = userLocation
    ? (() => {
        const projected = map.project([
          wrapLongitudeToAnchor(userLocation.lng, centerLng),
          userLocation.lat,
        ]);

        return {
          x: projected.x,
          y: projected.y,
        };
      })()
    : null;

  const focusTrackProjected =
    focusTrack?.length && focusTrack.length > 0
      ? focusTrack.map((point) => {
          const projected = map.project([
            wrapLongitudeToAnchor(point.lng, centerLng),
            point.lat,
          ]);

          return {
            x: projected.x,
            y: projected.y,
            minutesFromNow: point.minutesFromNow,
          };
        })
      : null;

  return {
    signature: getSceneSignature(map, satellites, selectedSatellite, userLocation, focusTrack),
    tier,
    zoom,
    projectedSatellites,
    clusters,
    selectedProjected,
    userProjected,
    focusTrackProjected,
  };
}

export function ConstellationMap({
  satellites,
  generatedAt,
  motionLeadSeconds = 10,
  selectedSatelliteId = null,
  onSelect,
  userLocation = null,
  userLocationStatus = "idle",
  onLocateUser,
  status = "ready",
  focusTrack,
  onViewportChange,
  className = "",
}: ConstellationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const viewportTimeoutRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const onSelectRef = useRef(onSelect);
  const onViewportChangeRef = useRef(onViewportChange);
  const pendingLocateRef = useRef(false);
  const satellitesRef = useRef(satellites);
  const generatedAtMsRef = useRef(Date.parse(generatedAt));
  const motionLeadMsRef = useRef(Math.max(1_000, motionLeadSeconds * 1000));
  const userLocationRef = useRef(userLocation);
  const focusTrackRef = useRef(focusTrack);
  const selectedSatelliteIdRef = useRef(selectedSatelliteId);
  const hoveredSatelliteIdRef = useRef<string | null>(null);
  const projectedSatellitesRef = useRef<ProjectedSatellite[]>([]);
  const sceneStateRef = useRef<SceneState | null>(null);
  const sceneDirtyRef = useRef(true);
  const [mapRuntimeError, setMapRuntimeError] = useState<string | null>(null);
  const [hoveredSatelliteId, setHoveredSatelliteId] = useState<string | null>(null);

  const selectedSatellite = useMemo(
    () => satellites.find((satellite) => satellite.id === selectedSatelliteId) ?? null,
    [satellites, selectedSatelliteId]
  );
  const selectedSatelliteRef = useRef<typeof selectedSatellite>(selectedSatellite);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(() => {
    satellitesRef.current = satellites;
  }, [satellites]);

  useEffect(() => {
    const parsed = Date.parse(generatedAt);
    generatedAtMsRef.current = Number.isFinite(parsed) ? parsed : Date.now();
  }, [generatedAt]);

  useEffect(() => {
    motionLeadMsRef.current = Math.max(1_000, motionLeadSeconds * 1000);
  }, [motionLeadSeconds]);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  useEffect(() => {
    focusTrackRef.current = focusTrack;
  }, [focusTrack]);

  useEffect(() => {
    selectedSatelliteIdRef.current = selectedSatelliteId;
  }, [selectedSatelliteId]);

  useEffect(() => {
    selectedSatelliteRef.current = selectedSatellite;
  }, [selectedSatellite]);

  useEffect(() => {
    hoveredSatelliteIdRef.current = hoveredSatelliteId;
  }, [hoveredSatelliteId]);

  useEffect(() => {
    sceneDirtyRef.current = true;
  }, [satellites, userLocation, focusTrack, selectedSatelliteId, generatedAt, motionLeadSeconds]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      attributionControl: false,
      dragRotate: false,
      touchPitch: false,
      maxPitch: 0,
      renderWorldCopies: true,
      maplibreLogo: false,
    });

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.imageSmoothingEnabled = true;
    };

    const emitViewport = () => {
      if (viewportTimeoutRef.current != null) {
        window.clearTimeout(viewportTimeoutRef.current);
      }

      viewportTimeoutRef.current = window.setTimeout(() => {
        const activeMap = mapRef.current;
        if (!activeMap) {
          return;
        }

        onViewportChangeRef.current?.(buildViewport(activeMap.getBounds(), activeMap));
      }, VIEWPORT_EMIT_DEBOUNCE_MS);
    };

    const rebuildScene = () => {
      const activeMap = mapRef.current;
      if (!activeMap) {
        return;
      }

      const nextScene = buildSceneState(
        activeMap,
        satellitesRef.current,
        selectedSatelliteRef.current,
        userLocationRef.current,
        focusTrackRef.current
      );
      projectedSatellitesRef.current = nextScene.projectedSatellites;
      sceneStateRef.current = nextScene;
      sceneDirtyRef.current = false;
    };

    const drawScene = (time: number) => {
      const activeMap = mapRef.current;
      const activeCanvas = canvasRef.current;
      if (!activeMap || !activeCanvas) {
        return;
      }

      const context = activeCanvas.getContext("2d");
      if (!context) {
        return;
      }

      const nextSignature = getSceneSignature(
        activeMap,
        satellitesRef.current,
        selectedSatelliteRef.current,
        userLocationRef.current,
        focusTrackRef.current
      );

      if (sceneDirtyRef.current || sceneStateRef.current?.signature !== nextSignature) {
        rebuildScene();
      }

      const scene = sceneStateRef.current;
      if (!scene) {
        return;
      }

      const width = activeCanvas.clientWidth;
      const height = activeCanvas.clientHeight;
      context.clearRect(0, 0, width, height);

      const zoom = scene.zoom;
      const isGlobal = scene.tier === "global";
      const isRegional = scene.tier === "regional";
      const pulse = (Math.sin(time / 700) + 1) / 2;
      const selectionPulse = (Math.sin(time / 420) + 1) / 2;
      const selectedId = selectedSatelliteIdRef.current;
      const hoveredId = hoveredSatelliteIdRef.current;
      const motionProgress = clamp(
        0,
        (Date.now() - generatedAtMsRef.current) / motionLeadMsRef.current,
        1
      );
      const animatedSatellites = scene.projectedSatellites.map((satellite) => ({
        ...satellite,
        x: interpolateValue(satellite.x, satellite.nextX, motionProgress),
        y: interpolateValue(satellite.y, satellite.nextY, motionProgress),
      }));
      const animatedSelected = scene.selectedProjected
        ? {
            ...scene.selectedProjected,
            x: interpolateValue(
              scene.selectedProjected.x,
              scene.selectedProjected.nextX,
              motionProgress
            ),
            y: interpolateValue(
              scene.selectedProjected.y,
              scene.selectedProjected.nextY,
              motionProgress
            ),
          }
        : null;
      const animatedClusters = isGlobal
        ? buildClusteredPoints(animatedSatellites, zoom)
        : [];

      projectedSatellitesRef.current = animatedSatellites;

      if (scene.focusTrackProjected?.length) {
        context.save();
        context.beginPath();
        context.lineCap = "round";
        context.lineJoin = "round";
        context.strokeStyle = "rgba(94, 234, 212, 0.7)";
        context.shadowBlur = isGlobal ? 14 : 26;
        context.shadowColor = "rgba(94, 234, 212, 0.42)";
        context.lineWidth = isGlobal ? 1.2 : zoom < 8 ? 1.8 : 2.6;

        scene.focusTrackProjected.forEach((point, index) => {
          if (index === 0) {
            context.moveTo(point.x, point.y);
            return;
          }
          context.lineTo(point.x, point.y);
        });

        context.stroke();
        context.restore();
      }

      if (animatedClusters.length > 0) {
        for (const cluster of animatedClusters) {
          const clusterGlow = isGlobal ? cluster.radius * 9.2 : cluster.radius * 6.4;
          drawGlow(
            context,
            cluster.x,
            cluster.y,
            clusterGlow,
            "56, 189, 248",
            isGlobal
              ? 0.16 + Math.min(0.24, cluster.count * 0.012)
              : 0.1 + Math.min(0.14, cluster.count * 0.008)
          );
          context.fillStyle = isGlobal
            ? `rgba(222, 247, 255, ${0.3 + Math.min(0.16, cluster.count * 0.016)})`
            : `rgba(190, 238, 255, ${0.38 + Math.min(0.18, cluster.count * 0.012)})`;
          context.beginPath();
          context.arc(cluster.x, cluster.y, cluster.radius, 0, Math.PI * 2);
          context.fill();
        }
      }

      if (animatedSatellites.length > 0) {
        for (const satellite of animatedSatellites) {
          const emphasized = satellite.id === selectedId || satellite.id === hoveredId;
          const shouldRenderPoint = !isGlobal || emphasized;
          const coreRadius = emphasized
            ? satellite.radius + 2 + selectionPulse * 0.7
            : Math.max(0.9, satellite.radius + (isGlobal ? -0.25 : isRegional ? 0.35 : 0));

          if (!shouldRenderPoint) {
            continue;
          }

          const glowScale = emphasized
            ? 8 + selectionPulse * 2.8
            : isGlobal
              ? 0
              : isRegional
                ? 6.1 + pulse * 0.8
                : 7.4 + pulse * 1.15;

          if (glowScale > 0 && (scene.tier !== "global" || emphasized)) {
            drawGlow(
              context,
              satellite.x,
              satellite.y,
              coreRadius * glowScale,
              emphasized ? "250, 204, 21" : "56, 189, 248",
              emphasized ? 0.3 : isRegional ? 0.16 : 0.2
            );
          }

          context.fillStyle = emphasized
            ? "#fff6c8"
            : isGlobal
              ? "rgba(222, 247, 255, 0.82)"
            : isRegional
              ? "rgba(225, 248, 255, 0.92)"
              : "rgba(224, 247, 255, 0.96)";
          context.beginPath();
          context.arc(satellite.x, satellite.y, coreRadius, 0, Math.PI * 2);
          context.fill();

          context.lineWidth = emphasized ? 1.6 : isRegional ? 1 : 0.95;
          context.strokeStyle = emphasized
            ? "rgba(250, 204, 21, 0.92)"
            : isGlobal
              ? "rgba(125, 211, 252, 0.2)"
            : isRegional
              ? "rgba(103, 214, 255, 0.58)"
              : "rgba(125, 211, 252, 0.52)";
          context.stroke();
        }
      }

      if (animatedSelected) {
        context.save();
        context.strokeStyle = `rgba(250, 204, 21, ${0.46 + selectionPulse * 0.2})`;
        context.lineWidth = 1.35;
        context.beginPath();
        context.arc(
          animatedSelected.x,
          animatedSelected.y,
          Math.max(14, animatedSelected.radius * 2.4) + selectionPulse * 4.2,
          0,
          Math.PI * 2
        );
        context.stroke();
        context.beginPath();
        context.arc(
          animatedSelected.x,
          animatedSelected.y,
          Math.max(6, animatedSelected.radius * 0.9) + selectionPulse * 1.6,
          0,
          Math.PI * 2
        );
        context.stroke();
        context.restore();
      }

      if (scene.userProjected) {
        const glowRadius = 16 + pulse * 4;

        drawGlow(context, scene.userProjected.x, scene.userProjected.y, glowRadius, "16, 185, 129", 0.24);
        if (scene.tier !== "global") {
          context.save();
          context.strokeStyle = "rgba(52, 211, 153, 0.25)";
          context.setLineDash([3, 8]);
          context.lineWidth = 1.1;
          context.beginPath();
          context.arc(scene.userProjected.x, scene.userProjected.y, 30 + pulse * 8, 0, Math.PI * 2);
          context.stroke();
          context.restore();
        }
        context.fillStyle = "#ffffff";
        context.beginPath();
        context.arc(scene.userProjected.x, scene.userProjected.y, 3.5, 0, Math.PI * 2);
        context.fill();
        context.lineWidth = 1.4;
        context.strokeStyle = "rgba(52, 211, 153, 0.92)";
        context.stroke();
      }
    };

    const tick = (time: number) => {
      drawScene(time);
      frameRef.current = window.requestAnimationFrame(tick);
    };

    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.on("error", (event) => {
      const reason =
        event?.error instanceof Error
          ? event.error.message
          : event?.error
            ? String(event.error)
            : "Map rendering failed.";
      setMapRuntimeError(reason);
    });

    map.on("load", () => {
      setMapRuntimeError(null);
      resizeCanvas();
      map.resize();
      emitViewport();
      sceneDirtyRef.current = true;
      rebuildScene();
      frameRef.current = window.requestAnimationFrame(tick);
    });

    map.on("move", () => {
      sceneDirtyRef.current = true;
    });
    map.on("moveend", emitViewport);
    map.on("zoomend", emitViewport);

    map.on("mousemove", (event) => {
      const nearest = findNearestSatellite(
        projectedSatellitesRef.current,
        event.point.x,
        event.point.y
      );
      setHoveredSatelliteId(nearest?.id ?? null);
      map.getCanvas().style.cursor = nearest ? "pointer" : "";
    });

    map.on("mouseleave", () => {
      setHoveredSatelliteId(null);
      map.getCanvas().style.cursor = "";
    });

    map.on("click", (event) => {
      const nearest = findNearestSatellite(
        projectedSatellitesRef.current,
        event.point.x,
        event.point.y
      );
      onSelectRef.current?.(nearest?.id ?? null);
    });

    resizeObserverRef.current = new ResizeObserver(() => {
      sceneDirtyRef.current = true;
      resizeCanvas();
      map.resize();
    });
    resizeObserverRef.current.observe(container);
    resizeCanvas();
    map.resize();

    return () => {
      if (viewportTimeoutRef.current != null) {
        window.clearTimeout(viewportTimeoutRef.current);
      }
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation || !pendingLocateRef.current) {
      return;
    }

    pendingLocateRef.current = false;
    map.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: USER_FOCUS_ZOOM,
      essential: true,
      duration: 1200,
    });
  }, [userLocation]);

  const statusTone =
    status === "ready"
      ? "rgba(125, 211, 252, 0.18)"
      : status === "loading"
        ? "rgba(251, 191, 36, 0.18)"
        : status === "error"
          ? "rgba(248, 113, 113, 0.18)"
          : "rgba(255, 255, 255, 0.08)";

  return (
    <div
      aria-label="Live Starlink constellation map"
      className={[
        "relative isolate h-full min-h-[70vh] overflow-hidden rounded-[32px] border border-white/8 bg-slate-950 shadow-[0_24px_120px_rgba(0,0,0,0.55)]",
        "backdrop-blur-xl",
        className,
      ].join(" ")}
    >
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />

      <div
        className="absolute right-4 top-4 z-20"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Locate me"
          title={
            userLocation
              ? "Center on your location"
              : userLocationStatus === "locating"
                ? "Finding your location"
                : "Use geolocation"
          }
          className="map-glass-control"
          disabled={userLocationStatus === "locating"}
          onClick={() => {
            const map = mapRef.current;

            if (userLocation && map) {
              map.flyTo({
                center: [userLocation.lng, userLocation.lat],
                zoom: USER_FOCUS_ZOOM,
                essential: true,
                duration: 1200,
              });
              return;
            }

            pendingLocateRef.current = true;
            onLocateUser?.();
          }}
        >
          <LocateFixed
            className={[
              "h-4 w-4 transition",
              userLocation ? "text-emerald-300" : "",
              userLocationStatus === "locating" ? "animate-pulse" : "",
            ].join(" ")}
          />
        </button>
      </div>

      <div
        className="pointer-events-none absolute inset-0 opacity-100"
        style={{
          background:
            "linear-gradient(180deg, rgba(2,6,23,0.02), rgba(2,6,23,0.08)), radial-gradient(circle at 50% 45%, rgba(15, 23, 42, 0.08), transparent 34%), radial-gradient(circle at 18% 18%, rgba(56, 189, 248, 0.05), transparent 28%), radial-gradient(circle at 82% 74%, rgba(16, 185, 129, 0.035), transparent 22%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_42%,rgba(2,6,23,0.08)_76%,rgba(2,6,23,0.18)_100%)]" />

      <div className="pointer-events-none absolute left-4 top-4 z-20 hidden sm:block">
        <div
          className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-slate-300 backdrop-blur-md"
          style={{ background: statusTone }}
        >
          Live constellation
        </div>
      </div>

      {mapRuntimeError ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex justify-center">
          <div className="rounded-full border border-rose-400/25 bg-black/35 px-4 py-2 text-xs tracking-[0.18em] text-rose-100 backdrop-blur-md">
            Map render issue: {mapRuntimeError}
          </div>
        </div>
      ) : null}
    </div>
  );
}
