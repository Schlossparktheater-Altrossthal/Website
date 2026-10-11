"use client";

import { usePathname, useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TicketShowOption } from "@/lib/karten/context";

/** Produktionsauswahl der Kartenseiten; nur sichtbar, wenn es mehr als eine gibt. */
export function TicketShowPicker({
  shows,
  selectedId,
}: {
  shows: TicketShowOption[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  if (shows.length < 2 || !selectedId) return null;
  return (
    <Select
      value={selectedId}
      onValueChange={(value) => router.push(`${pathname}?produktion=${encodeURIComponent(value)}`)}
    >
      <SelectTrigger className="w-full sm:w-72" aria-label="Produktion">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {shows.map((show) => (
          <SelectItem key={show.id} value={show.id}>
            {show.title}
            {show.enabled ? "" : " – kein Kartenverkauf"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
