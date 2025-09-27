"use client";

import { useCallback, useMemo, useState } from "react";
import { Share2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OnboardingSummary } from "@/lib/onboarding/dashboard-schemas";

const statusVariant: Record<OnboardingSummary["status"], "success" | "warning" | "muted"> = {
  active: "success",
  draft: "warning",
  completed: "muted",
  archived: "muted",
};

type HeaderBarProps = {
  onboardings: OnboardingSummary[];
  selectedId: string;
  statusLabel: string;
  status: OnboardingSummary["status"];
  timeSpan: string | null;
  participants: number;
  isRefreshing: boolean;
  onSelect: (id: string) => void;
  onRefresh?: () => void;
};

export function HeaderBar({
  onboardings,
  selectedId,
  statusLabel,
  status,
  timeSpan,
  participants,
  isRefreshing,
  onSelect,
  onRefresh,
}: HeaderBarProps) {
  const [shareState, setShareState] = useState<"idle" | "success" | "error">("idle");

  const statusText = useMemo(() => {
    switch (status) {
      case "active":
        return "Aktiv";
      case "draft":
        return "In Vorbereitung";
      case "completed":
        return "Abgeschlossen";
      case "archived":
        return "Archiviert";
      default:
        return statusLabel;
    }
  }, [status, statusLabel]);

  const handleShare = useCallback(async () => {
    try {
      const url = typeof window !== "undefined" ? window.location.href : "";
      if (navigator.share) {
        await navigator.share({ title: "Onboarding Dashboard", url });
      } else if (navigator.clipboard && url) {
        await navigator.clipboard.writeText(url);
      }
      setShareState("success");
      setTimeout(() => setShareState("idle"), 2000);
    } catch (error) {
      console.error("Share failed", error);
      setShareState("error");
      setTimeout(() => setShareState("idle"), 2500);
    }
  }, []);

  return (
    <Card className="flex flex-col gap-4 rounded-2xl border border-border/40 bg-card/70 p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
              Onboarding-Dashboard
            </h1>
            <Badge variant={statusVariant[status] ?? "muted"}>{statusText}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {timeSpan ? `Zeitraum ${timeSpan}` : "Zeitraum in Planung"} · {participants} Teilnehmende
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={selectedId} onValueChange={onSelect}>
            <SelectTrigger className="w-full min-w-[220px] sm:w-60">
              <SelectValue placeholder="Onboarding auswählen" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {onboardings.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground/90">{option.title}</span>
                    {option.periodLabel ? (
                      <span className="text-xs text-muted-foreground">{option.periodLabel}</span>
                    ) : null}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4" />
            {shareState === "success" ? "Link kopiert" : shareState === "error" ? "Fehler" : "Teilen"}
          </Button>
        </div>
      </div>
      {onRefresh ? (
        <Button
          type="button"
          variant="ghost"
          className="self-end text-sm text-muted-foreground hover:text-foreground"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? "Aktualisiere…" : "Refresh"}
        </Button>
      ) : null}
    </Card>
  );
}
