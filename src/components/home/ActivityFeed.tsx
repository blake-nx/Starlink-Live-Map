export type ActivityFeedProps = {
  generatedAt: string;
  source: string;
  pollIntervalSeconds: number;
  geolocationStatus: string;
  nearestSatelliteName?: string | null;
};

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }
  return timeFormatter.format(date);
}

function freshnessLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Freshness unknown";
  }

  const ageMs = Math.max(0, Date.now() - date.getTime());
  const ageSeconds = Math.round(ageMs / 1000);

  if (ageSeconds < 60) {
    return `Updated ${ageSeconds}s ago`;
  }

  const ageMinutes = Math.round(ageSeconds / 60);
  return `Updated ${ageMinutes}m ago`;
}

export function ActivityFeed({
  generatedAt,
  source,
  pollIntervalSeconds,
  geolocationStatus,
  nearestSatelliteName,
}: ActivityFeedProps) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/85 p-6 shadow-[0_40px_120px_-48px_rgba(8,15,30,0.9)] backdrop-blur-xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_26%)]" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-cyan-100/55">
              Activity feed
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Telemetry rhythm
            </h3>
          </div>
          <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
            Live telemetry
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="Source" value={source} />
          <Stat label="Freshness" value={freshnessLabel(generatedAt)} />
          <Stat label="Polling" value={`Every ${pollIntervalSeconds}s`} />
          <Stat label="Geolocation" value={geolocationStatus} />
        </div>

        <div className="mt-6 rounded-3xl border border-white/8 bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                Operational callouts
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Supporting context for the live constellation snapshot.
              </p>
            </div>
            <p className="text-xs text-slate-400">{formatTime(generatedAt)}</p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Callout title="Nearest satellite" value={nearestSatelliteName ?? "No nearby object selected"} />
            <Callout title="Polling cadence" value={`Refreshed every ${pollIntervalSeconds} seconds`} />
            <Callout title="Geolocation status" value={geolocationStatus} />
            <Callout title="Source integrity" value="Live feed normalized for dashboard use" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.04] p-4">
      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium leading-6 text-white">{value}</p>
    </div>
  );
}

function Callout({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-3xl border border-white/8 bg-slate-900/80 p-4">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/80">{value}</p>
    </article>
  );
}
