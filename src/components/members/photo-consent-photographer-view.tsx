"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ShowOption = { id: string; title: string; year: number; status: string };

type PhotographerRow = {
  userId: string;
  name: string;
  status: "pending" | "approved" | "rejected" | "noPhotos" | "none";
  permission: "allowed" | "restricted" | "forbidden";
  exclusionNote: string | null;
  isMinor: boolean;
  purposes: Array<{ label: string; chosen: boolean }>;
};

type OverviewPayload = {
  shows: ShowOption[];
  showId: string | null;
  showTitle: string | null;
  purposes: string[];
  rows: PhotographerRow[];
};

const PERMISSION_LABELS: Record<PhotographerRow["permission"], string> = {
  allowed: "Darf fotografiert werden",
  restricted: "Eingeschränkt",
  forbidden: "Nicht fotografieren",
};

const PERMISSION_BADGE_CLASSES: Record<PhotographerRow["permission"], string> = {
  allowed: "border-success/45 bg-success/15 text-success",
  restricted: "border-warning/45 bg-warning/15 text-warning",
  forbidden: "border-destructive/45 bg-destructive/15 text-destructive",
};

function CountBadge({
  label,
  count,
  className,
}: {
  label: string;
  count: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <span className="font-semibold">{count}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

export function PhotoConsentPhotographerView() {
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [showId, setShowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (targetShowId: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const query = targetShowId ? `?showId=${encodeURIComponent(targetShowId)}` : "";
      const response = await fetch(`/api/photo-consents/overview${query}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Fotoliste konnte nicht geladen werden");
        return;
      }
      setData(payload as OverviewPayload);
      setShowId((payload as OverviewPayload).showId);
    } catch {
      setError("Netzwerkfehler beim Laden der Fotoliste");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null);
  }, [load]);

  const rows = data?.rows ?? [];
  const purposes = data?.purposes ?? [];
  const allowed = rows.filter((row) => row.permission === "allowed").length;
  const restricted = rows.filter((row) => row.permission === "restricted").length;
  const forbidden = rows.filter((row) => row.permission === "forbidden").length;

  return (
    <Card variant="plain" size="flush">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Fotoliste</h2>
            <p className="text-xs text-muted-foreground">
              Wer darf fotografiert werden – ohne Verwaltungsfunktionen.
            </p>
          </div>
          <div className="ml-auto">
            <Select
              value={showId ?? ""}
              onValueChange={(value) => void load(value)}
              disabled={loading && !data}
            >
              <SelectTrigger className="h-9 w-52" aria-label="Produktion auswählen">
                <SelectValue placeholder="Produktion" />
              </SelectTrigger>
              <SelectContent>
                {(data?.shows ?? []).map((show) => (
                  <SelectItem key={show.id} value={show.id}>
                    {show.title} ({show.year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-y border-border/60 py-2">
              <CountBadge label="dürfen" count={allowed} className="text-success" />
              <CountBadge label="eingeschränkt" count={restricted} className="text-warning" />
              <CountBadge label="nicht" count={forbidden} className="text-destructive" />
            </div>

            {rows.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Für diese Produktion sind noch keine Mitglieder mit Fotoerlaubnis erfasst.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Desktop: Tabelle */}
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
                        <th className="px-2 py-2 font-medium">Name</th>
                        <th className="px-2 py-2 font-medium">Fotografieren</th>
                        {purposes.map((purpose) => (
                          <th key={purpose} className="px-2 py-2 text-center font-medium">
                            {purpose}
                          </th>
                        ))}
                        <th className="px-2 py-2 font-medium">Ausschlüsse</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.userId} className="border-b border-border/50 align-top">
                          <td className="px-2 py-2">
                            <span className="font-medium text-foreground">
                              {row.name}
                              {row.isMinor ? (
                                <Badge size="sm" variant="muted" className="ml-2">
                                  Minderjährig
                                </Badge>
                              ) : null}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <Badge
                              size="sm"
                              className={cn(
                                "whitespace-nowrap",
                                PERMISSION_BADGE_CLASSES[row.permission],
                              )}
                            >
                              {PERMISSION_LABELS[row.permission]}
                            </Badge>
                          </td>
                          {purposes.map((purpose) => {
                            const chosen =
                              row.purposes.find((entry) => entry.label === purpose)?.chosen ??
                              false;
                            return (
                              <td key={purpose} className="px-2 py-2 text-center">
                                {chosen ? "✓" : "–"}
                              </td>
                            );
                          })}
                          <td className="px-2 py-2 text-muted-foreground">
                            {row.exclusionNote ?? "–"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobil/Tablet: Karten */}
                <ul className="space-y-2 lg:hidden">
                  {rows.map((row) => (
                    <li key={row.userId} className="rounded-lg border border-border/60 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-foreground">
                          {row.name}
                          {row.isMinor ? (
                            <Badge size="sm" variant="muted" className="ml-2">
                              Minderjährig
                            </Badge>
                          ) : null}
                        </span>
                        <Badge
                          size="sm"
                          className={cn(
                            "whitespace-nowrap",
                            PERMISSION_BADGE_CLASSES[row.permission],
                          )}
                        >
                          {PERMISSION_LABELS[row.permission]}
                        </Badge>
                      </div>
                      {row.exclusionNote ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Ausschlüsse: {row.exclusionNote}
                        </p>
                      ) : null}
                      {purposes.length > 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Erlaubt:{" "}
                          {purposes
                            .filter(
                              (purpose) =>
                                row.purposes.find((entry) => entry.label === purpose)?.chosen,
                            )
                            .join(", ") || "–"}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
