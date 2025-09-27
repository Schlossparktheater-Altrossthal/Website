"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OnboardingDashboardData } from "@/lib/onboarding/dashboard-schemas";

import { DistributionBars } from "./distribution-bars";

type HistoryTabProps = {
  history: OnboardingDashboardData["history"] | undefined;
};

export function HistoryTab({ history }: HistoryTabProps) {
  if (!history || history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">
            Historie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Für dieses Onboarding liegen noch keine Vergleichsdaten vor.
          </p>
        </CardContent>
      </Card>
    );
  }

  const participants = history.map((item) => ({
    label: item.label,
    value: item.participants,
  }));
  const medianAge = history
    .filter((item) => item.medianAge !== null)
    .map((item) => ({
      label: item.label,
      value: item.medianAge ?? 0,
    }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">
            Historischer Vergleich
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-3 py-2">Onboarding</th>
                  <th className="px-3 py-2">Teilnehmer</th>
                  <th className="px-3 py-2">Medianalter</th>
                  <th className="px-3 py-2">Fokus both</th>
                  <th className="px-3 py-2">Start</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.onboardingId} className="border-t border-border/40">
                    <td className="px-3 py-2 font-medium text-foreground/80">{item.label}</td>
                    <td className="px-3 py-2">{item.participants}</td>
                    <td className="px-3 py-2">{item.medianAge ? `${item.medianAge.toFixed(1)} Jahre` : "–"}</td>
                    <td className="px-3 py-2">{item.focusBothShare ? `${item.focusBothShare.toFixed(0)}%` : "–"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <DistributionBars title="Teilnehmende" items={participants} />
        <DistributionBars title="Medianalter" items={medianAge} />
      </div>
    </div>
  );
}
