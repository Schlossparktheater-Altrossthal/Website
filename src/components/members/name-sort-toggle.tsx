"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { NAME_SORT_COOKIE, type NameSortOrder } from "@/lib/names";

/** Umschalter Vorname/Nachname/Rolle – gilt für alle Personenlisten (Cookie, ein Jahr). */
export function NameSortToggle({ value, className }: { value: NameSortOrder; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <SegmentedControl
      aria-label="Personen sortieren nach"
      value={value}
      className={className}
      onValueChange={(next) => {
        document.cookie = `${NAME_SORT_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        startTransition(() => router.refresh());
      }}
      options={[
        { value: "first", label: "Vorname", disabled: pending },
        { value: "last", label: "Nachname", disabled: pending },
        { value: "role", label: "Rolle", disabled: pending },
      ]}
    />
  );
}
