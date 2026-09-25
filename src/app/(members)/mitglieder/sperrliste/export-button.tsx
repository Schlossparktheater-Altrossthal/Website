"use client";

import { useState } from "react";
import { addDays, format, startOfToday } from "date-fns";
import { de } from "date-fns/locale/de";
import { toast } from "sonner";

import { FileDownIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { buildDayInfos, type FinalWeekRange } from "@/lib/sperrliste/day-tiers";
import { formatWeekdayList, sortWeekdays } from "@/lib/weekdays";
import type { HolidayRange } from "@/types/holidays";

import type { MemberGroup, TeamEntry, TeamMember } from "./types";

const PDF_ZONE: Record<MemberGroup, "acting" | "crew" | "both" | "unknown"> = {
  actors: "acting",
  crew: "crew",
  both: "both",
  other: "unknown",
};

const FALLBACK_LABEL = { blocked: "gesperrt", limited: "eingeschränkt", preferred: "bevorzugt" };

type ExportButtonProps = {
  members: TeamMember[];
  entries: TeamEntry[];
  holidays: HolidayRange[];
  finalWeek: FinalWeekRange;
  preferredWeekdays: number[];
  exceptionWeekdays: number[];
};

function filenameFrom(disposition: string | null, fallback: string) {
  const match = disposition?.match(/filename\*=UTF-8''([^;]+)/i);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch (error) {
      console.warn("[sperrliste:export] Dateiname nicht lesbar", error);
    }
  }
  return fallback;
}

/** Probentage der nächsten zwei Wochen als PDF (gleiche Vorlage wie bisher). */
export function ExportButton({
  members,
  entries,
  holidays,
  finalWeek,
  preferredWeekdays,
  exceptionWeekdays,
}: ExportButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    const start = startOfToday();
    const end = addDays(start, 13);
    const days = buildDayInfos(
      { start, end },
      { preferredWeekdays, exceptionWeekdays, holidays, finalWeek },
    ).filter((day) => day.tier !== "off");
    if (!days.length) {
      toast.info("Keine Probentage in den nächsten zwei Wochen", { duration: 2000 });
      return;
    }

    const byMemberDay = new Map(entries.map((entry) => [`${entry.userId}:${entry.date}`, entry]));
    const rangeLabel = `${format(start, "dd.MM.yyyy")} – ${format(end, "dd.MM.yyyy")}`;
    const important = sortWeekdays([...preferredWeekdays, ...exceptionWeekdays]);

    setBusy(true);
    try {
      const response = await fetch("/api/pdfs/sperrliste-wichtige-tage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          range: { start: start.toISOString(), end: end.toISOString(), label: rangeLabel },
          summary: {
            memberCount: members.length,
            importantWeekdays: important.length ? formatWeekdayList(important) : null,
          },
          days: days.map((day) => ({
            key: day.key,
            label: format(day.date, "EEEEEE dd.MM.", { locale: de }),
            title: format(day.date, "EEEE, d. MMMM yyyy", { locale: de }),
          })),
          members: members.map((member) => ({
            zone: PDF_ZONE[member.group],
            name: member.name,
            email: null,
            entries: days.map((day) => {
              const entry = byMemberDay.get(`${member.id}:${day.key}`);
              return entry
                ? {
                    dayKey: day.key,
                    status: entry.status,
                    value: entry.reason || FALLBACK_LABEL[entry.status],
                  }
                : { dayKey: day.key, status: "none", value: null };
            }),
          })),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "PDF konnte nicht erstellt werden.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFrom(
        response.headers.get("content-disposition"),
        `sperrliste-${format(start, "yyyyMMdd")}.pdf`,
      ).replace(/[\\/\r\n]/g, "_");
      link.click();
      URL.revokeObjectURL(url);
      toast.success("PDF heruntergeladen", { duration: 3000 });
    } catch (error) {
      console.error("[sperrliste:export]", error);
      toast.error("Export fehlgeschlagen", {
        description: error instanceof Error ? error.message : undefined,
        duration: 5000,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AsyncButton
      type="button"
      size="sm"
      variant="outline"
      isLoading={busy}
      loadingText="PDF …"
      onClick={handleExport}
      aria-label="PDF exportieren"
    >
      <FileDownIcon className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">PDF</span>
    </AsyncButton>
  );
}
