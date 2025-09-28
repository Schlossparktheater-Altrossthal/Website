import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { tv } from "tailwind-variants";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const overviewMetricStyles = tv({
  slots: {
    card: "group min-h-[184px] border border-border/70 bg-background/95 shadow-sm transition-colors [--metric-accent:var(--chart-1)]",
    header: "flex items-start justify-between gap-3",
    headerContent: "flex items-center gap-3",
    icon: "flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--metric-accent)]/40 bg-[color:var(--metric-accent)]/12 text-[color:var(--metric-accent)]",
    title: "text-sm font-semibold text-foreground",
    subtitle: "text-xs text-muted-foreground/80 line-clamp-2",
    value: "text-3xl font-semibold tracking-tight text-foreground",
    description: "text-xs text-muted-foreground line-clamp-2",
  },
  variants: {
    tone: {
      emerald: {
        card: "[--metric-accent:var(--chart-2)]",
      },
      sky: {
        card: "[--metric-accent:var(--chart-4)]",
      },
      amber: {
        card: "[--metric-accent:var(--chart-3)]",
      },
      violet: {
        card: "[--metric-accent:var(--chart-5)]",
      },
      rose: {
        card: "[--metric-accent:var(--chart-1)]",
      },
      indigo: {
        card: "[--metric-accent:var(--primary)]",
      },
      slate: {
        card: "[--metric-accent:var(--muted-foreground)]",
      },
    },
  },
  defaultVariants: {
    tone: "slate",
  },
});

export type OverviewMetricTone =
  | "emerald"
  | "sky"
  | "amber"
  | "violet"
  | "rose"
  | "indigo"
  | "slate";

export type OverviewMetricDefinition = {
  id: string;
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone?: OverviewMetricTone;
  secondary?: string;
};

type OverviewMetricsProps = {
  metrics: OverviewMetricDefinition[];
  renderBadge?: () => ReactNode;
};

export function OverviewMetrics({ metrics, renderBadge }: OverviewMetricsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const styles = overviewMetricStyles({ tone: metric.tone });

        return (
          <Card key={metric.id} className={styles.card()}>
            <CardHeader className="pb-3">
              <div className={styles.header()}>
                <div className={styles.headerContent()}>
                  <span className={styles.icon()} aria-hidden>
                    <metric.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <CardTitle className={styles.title()}>{metric.label}</CardTitle>
                    {metric.secondary ? (
                      <p className={styles.subtitle()}>{metric.secondary}</p>
                    ) : null}
                  </div>
                </div>
                {renderBadge ? <span className="shrink-0">{renderBadge()}</span> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className={styles.value()}>{metric.value}</p>
              <p className={styles.description()}>{metric.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
