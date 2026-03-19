import type { ReactNode } from "react";

export type OrbitalInsightsProps = {
  metrics: {
    total: number;
    averageAltitudeKm: number;
    averageSpeedKps: number;
    shellBreakdown: Array<{ label: string; value: number }>;
    hemisphereBreakdown: Array<{ label: string; value: number }>;
    nearestDistanceKm?: number | null;
  };
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

function formatNumber(value: number) {
  if (Number.isNaN(value)) {
    return "N/A";
  }
  return numberFormatter.format(value);
}

function total(values: Array<{ value: number }>) {
  return values.reduce((sum, item) => sum + item.value, 0);
}

export function OrbitalInsights({ metrics }: OrbitalInsightsProps) {
  const shellTotal = Math.max(total(metrics.shellBreakdown), 1);
  const hemisphereTotal = Math.max(total(metrics.hemisphereBreakdown), 1);

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/85 p-6 shadow-[0_40px_120px_-48px_rgba(8,15,30,0.9)] backdrop-blur-xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.15),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_30%)]" />
      <div className="relative">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-cyan-100/55">
              Orbital insights
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Constellation structure
            </h3>
          </div>
          <div className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
            {formatNumber(metrics.total)} total
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Average altitude" value={`${formatNumber(metrics.averageAltitudeKm)} km`} hint="Orbital height" />
          <StatCard label="Average speed" value={`${formatNumber(metrics.averageSpeedKps)} km/s`} hint="Current velocity" />
          <StatCard label="Shell count" value={String(metrics.shellBreakdown.length)} hint="Orbital layers" />
          <StatCard
            label="Nearest distance"
            value={
              typeof metrics.nearestDistanceKm === "number"
                ? `${formatNumber(metrics.nearestDistanceKm)} km`
                : "N/A"
            }
            hint="Closest live pass"
          />
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Panel title="Shell distribution" subtitle="Density by orbital layer and relative share.">
            <div className="space-y-3">
              {metrics.shellBreakdown.length > 0 ? (
                metrics.shellBreakdown.map((shell) => {
                  const share = Math.round((shell.value / shellTotal) * 100);
                  return (
                    <BreakdownRow
                      key={shell.label}
                      label={shell.label}
                      value={shell.value}
                      share={share}
                    />
                  );
                })
              ) : (
                <EmptyState text="Shell breakdown will appear when the live feed includes orbital grouping." />
              )}
            </div>
          </Panel>

          <Panel title="Hemisphere balance" subtitle="North and south flow through the current snapshot.">
            <div className="space-y-3">
              {metrics.hemisphereBreakdown.length > 0 ? (
                metrics.hemisphereBreakdown.map((item) => {
                  const share = Math.round((item.value / hemisphereTotal) * 100);
                  return (
                    <BreakdownRow
                      key={item.label}
                      label={item.label}
                      value={item.value}
                      share={share}
                    />
                  );
                })
              ) : (
                <EmptyState text="Hemisphere data is not available in the current snapshot." />
              )}
            </div>
          </Panel>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.04] p-5">
      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-300">{hint}</p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.04] p-5">
      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{title}</p>
      <p className="mt-2 text-sm text-slate-300">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  share,
}: {
  label: string;
  value: number;
  share: number;
}) {
  return (
    <div className="rounded-3xl border border-white/8 bg-slate-900/80 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="mt-1 text-xs text-slate-400">{formatNumber(value)} satellites</p>
        </div>
        <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-xs text-slate-200">
          {share}%
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500"
          style={{ width: `${Math.max(0, Math.min(100, share))}%` }}
        />
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/60 p-5 text-sm leading-6 text-slate-300">
      {text}
    </div>
  );
}
