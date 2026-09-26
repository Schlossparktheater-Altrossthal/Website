"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SectionNavItem } from "@/lib/ui-standards";
import { cn } from "@/lib/utils";

/**
 * Mobil-Fallback einer Bereichs-Navigation mit mehr als drei Einträgen
 * (docs/design-system.md, Abschnitt "Seiten-Muster"): Pills passen dann nicht mehr in
 * eine Zeile, ein Auswahlfeld bleibt eindeutig bedienbar.
 */
export function SectionNavSelect({
  items,
  activeId,
  ariaLabel,
  className,
}: {
  items: readonly SectionNavItem[];
  activeId: string;
  ariaLabel: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <div className={cn("w-full", className)}>
      <Select
        value={activeId}
        onValueChange={(value) => {
          const target = items.find((item) => item.id === value);
          if (target) router.push(target.href, { scroll: false });
        }}
      >
        <SelectTrigger aria-label={ariaLabel} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {typeof item.label === "string" ? item.label : item.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
