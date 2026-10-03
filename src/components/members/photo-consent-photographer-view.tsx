"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PhotoConsentLevelDot } from "@/components/photo-consent/photo-consent-level-badge";
import { SearchIcon } from "@/components/ui/action-icons";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PHOTO_PERMISSION_HINTS,
  PHOTO_PERMISSION_LABELS,
  PHOTO_PERMISSION_ORDER,
  PHOTO_PERMISSION_TONES,
  type PhotoPermission,
} from "@/lib/photo-consent-permissions";

type ShowOption = { id: string; title: string; year: number; status: string };

type PhotographerRow = {
  userId: string;
  name: string;
  permission: PhotoPermission;
  exclusionNote: string | null;
  isMinor: boolean;
};

type OverviewPayload = {
  shows: ShowOption[];
  showId: string | null;
  showTitle: string | null;
  rows: PhotographerRow[];
};

/** Fotoliste für Fotografen: eine Ampel je Person, restriktivste zuerst, Hinweise direkt sichtbar. */
export function PhotoConsentPhotographerView() {
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [showId, setShowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async (targetShowId: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const query = targetShowId ? `?showId=${encodeURIComponent(targetShowId)}` : "";
      const response = await fetch(`/api/photo-consents/overview${query}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Fotoliste konnte nicht geladen werden.");
        return;
      }
      setData(payload as OverviewPayload);
      setShowId((payload as OverviewPayload).showId);
    } catch {
      setError("Netzwerkfehler beim Laden der Fotoliste.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null);
  }, [load]);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = (data?.rows ?? []).filter((row) => !term || row.name.toLowerCase().includes(term));
    return PHOTO_PERMISSION_ORDER.map((permission) => ({
      permission,
      rows: rows.filter((row) => row.permission === permission),
    })).filter((group) => group.rows.length > 0);
  }, [data?.rows, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name suchen"
            aria-label="Fotoliste durchsuchen"
            className="min-h-11 pl-9"
          />
        </div>
        <Select
          value={showId ?? ""}
          onValueChange={(value) => void load(value)}
          disabled={loading && !data}
        >
          <SelectTrigger className="min-h-11 w-full min-w-0 sm:w-56" aria-label="Produktion">
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

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : groups.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {search
            ? "Niemand passt zur Suche."
            : "Für diese Produktion sind keine Mitglieder erfasst."}
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.permission} className="space-y-1.5">
              <h3 className="flex flex-wrap items-baseline gap-x-2 px-1 text-sm font-semibold text-foreground">
                <span className="inline-flex items-center gap-2">
                  <PhotoConsentLevelDot tone={PHOTO_PERMISSION_TONES[group.permission]} />
                  {PHOTO_PERMISSION_LABELS[group.permission]}
                  <span className="font-normal text-muted-foreground tabular-nums">
                    {group.rows.length}
                  </span>
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {PHOTO_PERMISSION_HINTS[group.permission]}
                </span>
              </h3>
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {group.rows.map((row) => (
                  <li
                    key={row.userId}
                    className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2"
                  >
                    <span className="min-w-0 text-sm font-medium text-foreground">{row.name}</span>
                    {row.isMinor ? (
                      <Badge variant="muted" size="sm">
                        U18
                      </Badge>
                    ) : null}
                    {row.exclusionNote ? (
                      <span className="w-full min-w-0 break-words text-xs text-warning sm:ml-auto sm:w-auto">
                        {row.exclusionNote}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
