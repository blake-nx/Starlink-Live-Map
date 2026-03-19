type MetricTone = "cyan" | "teal" | "amber" | "rose";

export type MetricStripProps = {
  metrics: Array<{
    label: string;
    value: string;
    detail?: string;
    tone?: MetricTone;
  }>;
};

const toneStyles: Record<MetricTone, string> = {
  cyan: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100",
  teal: "border-teal-400/20 bg-teal-400/10 text-teal-100",
  amber: "border-amber-400/20 bg-amber-400/10 text-amber-100",
  rose: "border-rose-400/20 bg-rose-400/10 text-rose-100",
};

const toneDots: Record<MetricTone, string> = {
  cyan: "bg-cyan-300",
  teal: "bg-teal-300",
  amber: "bg-amber-300",
  rose: "bg-rose-300",
};

export function MetricStrip({ metrics }: MetricStripProps) {
  return (
    <section
      aria-label="Telemetry metrics"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {metrics.map((metric, index) => (
        <article
          key={metric.label}
          className="metric-card group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_60px_rgba(1,6,20,0.25)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white/[0.06]"
          style={{ animationDelay: `${index * 75}ms` }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.10),_transparent_30%)] opacity-80" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-slate-500">
                {metric.label}
              </p>
              <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
                {metric.value}
              </p>
              {metric.detail ? (
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {metric.detail}
                </p>
              ) : null}
            </div>

            {metric.tone ? (
              <span
                aria-hidden="true"
                className={`inline-flex shrink-0 h-3.5 w-3.5 rounded-full border ${toneDots[metric.tone]} ${toneStyles[metric.tone]}`}
              />
            ) : null}
          </div>
        </article>
      ))}
      <style jsx>{`
        .metric-card {
          animation: metricCardEnter 720ms ease both;
        }

        @keyframes metricCardEnter {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}
