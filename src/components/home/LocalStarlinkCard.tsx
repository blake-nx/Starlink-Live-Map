import { Orbit, Target, Waves, X } from "lucide-react";

type LocalStarlink = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  altitudeKm: number;
  velocityKps: number;
  inclinationDeg?: number | null;
  orbitMinutes?: number | null;
  distanceKm?: number | null;
  elevationDeg?: number | null;
  aboveHorizon?: boolean;
};

export type LocalStarlinkCardProps = {
  satellites: LocalStarlink[];
  selectedSatelliteId?: string | null;
  onSelect?: (satelliteId: string) => void;
  onDismiss?: () => void;
  title?: string;
  emptyLabel?: string;
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A";
  }

  return numberFormatter.format(value);
}

function formatCompactDistance(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return `${formatNumber(value)} km`;
}

export function LocalStarlinkCard({
  satellites,
  selectedSatelliteId = null,
  onSelect,
  onDismiss,
  title = "Starlinks over you",
  emptyLabel = "No Starlinks above your horizon right now.",
}: LocalStarlinkCardProps) {
  const visibleNowCount = satellites.length;
  const highestElevation = satellites.reduce<number | null>((best, satellite) => {
    const elevation =
      typeof satellite.elevationDeg === "number" && Number.isFinite(satellite.elevationDeg)
        ? satellite.elevationDeg
        : null;

    if (elevation == null) {
      return best;
    }

    if (best == null || elevation > best) {
      return elevation;
    }

    return best;
  }, null);

  return (
    <section
      aria-label="Starlinks over your location"
      className="satellite-card p-5 text-white sm:p-6"
    >
      <div className="relative flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="satellite-chip satellite-chip--live">
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)]" />
                Local sky
              </span>
              <span className="satellite-chip">
                <Waves className="h-3.5 w-3.5" />
                Horizon aware
              </span>
            </div>
            <p className="satellite-card__eyebrow">{title}</p>
            <h3 className="mt-3 text-[1.45rem] font-semibold tracking-tight text-white sm:text-[1.65rem]">
              {satellites.length > 0 ? `${satellites.length} overhead now` : "No overhead pass"}
            </h3>
            <p className="satellite-card__subtitle mt-2 text-sm">
              {satellites.length > 0
                ? "Satellites currently above your horizon."
                : "No Starlinks are above your horizon right now."}
            </p>
          </div>

          <div className="flex shrink-0 items-start gap-2">
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                className="satellite-card__close-button"
                aria-label="Hide local sky panel"
                title="Hide local sky panel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <div className="satellite-card__orbital-mark shrink-0">
              <Target className="h-4 w-4 text-emerald-200" />
            </div>
          </div>
        </div>

        <div className="satellite-card__rail" />

        <div className="satellite-card__summary">
          <span className="satellite-card__summary-item">
            <Orbit className="h-3.5 w-3.5" />
            {visibleNowCount > 0 ? `${visibleNowCount} overhead` : "No overhead lock"}
          </span>
          <span className="satellite-card__summary-item">
            <Target className="h-3.5 w-3.5" />
            {highestElevation != null ? `${formatNumber(highestElevation)} deg highest` : "Awaiting next rise"}
          </span>
        </div>

        {satellites.length > 0 ? (
          <div className="satellite-list max-h-[24rem] overflow-y-auto pr-1">
            {satellites.map((satellite) => {
              const distance = formatCompactDistance(satellite.distanceKm ?? null);
              const elevation = typeof satellite.elevationDeg === "number" && Number.isFinite(satellite.elevationDeg)
                ? Math.max(0, Math.min(90, satellite.elevationDeg))
                : null;
              const visibilityScore =
                satellite.aboveHorizon
                  ? 100
                  : elevation != null
                    ? Math.round((elevation / 90) * 100)
                    : 18;

              return (
                <button
                  key={satellite.id}
                  type="button"
                  onClick={() => onSelect?.(satellite.id)}
                  className={[
                    "satellite-list-item",
                    selectedSatelliteId === satellite.id ? "satellite-list-item--selected" : "",
                  ].join(" ")}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.92rem] font-medium tracking-[0.01em] text-white">
                      {satellite.name}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {distance ? (
                        <span className="satellite-location">{distance} away</span>
                      ) : null}
                      {typeof satellite.elevationDeg === "number" &&
                      Number.isFinite(satellite.elevationDeg) ? (
                        <span className="satellite-location">
                          {formatNumber(satellite.elevationDeg)} deg up
                        </span>
                      ) : null}
                    </div>
                    <div className="satellite-list-item__meter" aria-hidden="true">
                      <span
                        className={[
                          "satellite-list-item__meter-fill",
                          satellite.aboveHorizon ? "satellite-list-item__meter-fill--live" : "",
                        ].join(" ")}
                        style={{ width: `${visibilityScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span
                      className={[
                        "satellite-chip",
                        "satellite-chip--live",
                      ].join(" ")}
                    >
                      Overhead
                    </span>
                    <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
                      NORAD {satellite.id}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="satellite-empty satellite-stat p-4">
            <p className="satellite-stat__label">No live passes</p>
            <p className="satellite-stat__value mt-2 text-sm">{emptyLabel}</p>
          </div>
        )}
      </div>
    </section>
  );
}
