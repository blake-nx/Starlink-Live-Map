import { Satellite, Radar, X } from "lucide-react";

export type SelectionCardProps = {
  satellite: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    altitudeKm: number;
    velocityKps: number;
    inclinationDeg?: number | null;
    orbitMinutes?: number | null;
  } | null;
  onClear?: () => void;
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "N/A";
  }

  return numberFormatter.format(value);
}

function formatValue(value: number | null | undefined, suffix: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A";
  }

  return `${formatNumber(value)} ${suffix}`;
}

export function SelectionCard({ satellite, onClear }: SelectionCardProps) {
  if (!satellite) {
    return null;
  }

  return (
    <section
      aria-label="Selected satellite"
      className="satellite-card p-5 text-white sm:p-6"
    >
      <div className="relative flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="satellite-chip satellite-chip--live">
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)]" />
                Focus lock
              </span>
              <span className="satellite-chip">
                <Satellite className="h-3.5 w-3.5" />
                Live telemetry
              </span>
            </div>
            <p className="satellite-card__eyebrow">Selected satellite</p>
            <h3 className="mt-3 truncate text-[1.65rem] font-semibold tracking-tight text-white sm:text-[1.9rem]">
              {satellite.name}
            </h3>
            <p className="satellite-card__subtitle mt-2 text-sm">
              NORAD {satellite.id}
            </p>
          </div>

          <div className="flex shrink-0 items-start gap-2">
            {onClear ? (
              <button
                type="button"
                onClick={onClear}
                className="satellite-card__close-button"
                aria-label="Clear selected satellite"
                title="Clear selection"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <div className="satellite-card__orbital-mark shrink-0">
              <Radar className="h-4 w-4 text-cyan-200" />
            </div>
          </div>
        </div>

        <div className="satellite-card__rail" />

        <div className="grid gap-3 sm:grid-cols-2">
          <Stat label="Altitude" value={formatValue(satellite.altitudeKm, "km")} />
          <Stat label="Velocity" value={formatValue(satellite.velocityKps, "km/s")} />
          <Stat
            label="Inclination"
            value={formatValue(satellite.inclinationDeg ?? null, "deg")}
          />
          <Stat
            label="Orbit period"
            value={formatValue(satellite.orbitMinutes ?? null, "min")}
          />
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-slate-300">
          <span className="satellite-location" aria-label={`Latitude ${formatNumber(satellite.lat)}`}>
            {formatNumber(satellite.lat)} latitude
          </span>
          <span className="satellite-location" aria-label={`Longitude ${formatNumber(satellite.lng)}`}>
            {formatNumber(satellite.lng)} longitude
          </span>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="satellite-stat satellite-stat--focus p-4">
      <p className="satellite-stat__label">
        {label}
      </p>
      <p className="satellite-stat__value mt-2">
        {value}
      </p>
    </div>
  );
}
