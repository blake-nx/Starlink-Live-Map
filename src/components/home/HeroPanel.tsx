export type HeroPanelProps = {
  totalSatellites: number;
  averageAltitudeKm: number;
  averageSpeedKps: number;
  trackedNow: number;
  source: string;
  lastUpdated: string;
  geolocationStatus: string;
};

type StatCard = {
  label: string;
  value: string;
  detail: string;
};

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function HeroPanel({
  totalSatellites,
  averageAltitudeKm,
  averageSpeedKps,
  trackedNow,
  source,
  lastUpdated,
  geolocationStatus,
}: HeroPanelProps) {
  const cards: StatCard[] = [
    {
      label: "Tracked now",
      value: formatNumber(trackedNow),
      detail: "Satellites inside the live viewport",
    },
    {
      label: "Total catalog",
      value: formatNumber(totalSatellites),
      detail: "Current Starlink records loaded from source",
    },
    {
      label: "Average altitude",
      value: `${formatNumber(averageAltitudeKm, 1)} km`,
      detail: "Mean orbital height in the active shell",
    },
    {
      label: "Average speed",
      value: `${formatNumber(averageSpeedKps, 2)} km/s`,
      detail: "Velocity derived from the current TLE snapshot",
    },
  ];

  return (
    <section
      aria-labelledby="hero-panel-title"
      className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 px-6 py-8 shadow-[0_30px_120px_rgba(1,6,20,0.45)] ring-1 ring-white/5 backdrop-blur-xl sm:px-8 sm:py-10 lg:px-10 lg:py-12"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.16),_transparent_24%),linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(2,6,23,0.82))]" />
      <div className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="absolute -right-24 bottom-0 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)] lg:items-end">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-100">
              Live Starlink
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(74,222,128,0.7)] animate-pulse" />
              {geolocationStatus}
            </span>
            <span className="text-xs text-slate-400">{lastUpdated}</span>
          </div>

          <div className="max-w-3xl space-y-4">
            <h1
              id="hero-panel-title"
              className="text-balance text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl lg:text-7xl"
            >
              The constellation, rendered in real time.
            </h1>
            <p className="max-w-2xl text-pretty text-base leading-7 text-slate-300 sm:text-lg">
              A premium live Starlink view that turns the current orbital state
              into something you can scan, trust, and explore without fighting
              the interface.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
              Source: {source}
            </span>
            <span className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
              {formatNumber(totalSatellites)} total tracked
            </span>
          </div>
        </div>

        <aside className="relative">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                  Live telemetry
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Snapshot of the current orbital state
                </p>
              </div>
              <div className="h-12 w-12 rounded-2xl border border-cyan-400/20 bg-cyan-400/10" />
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              {cards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                >
                  <dt className="text-xs uppercase tracking-[0.28em] text-slate-500">
                    {card.label}
                  </dt>
                  <dd className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                    {card.value}
                  </dd>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {card.detail}
                  </p>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>
    </section>
  );
}
