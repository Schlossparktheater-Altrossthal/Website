"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { LayoutGridIcon, ListIcon } from "@/components/ui/action-icons";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { INVENTORY_VIEW_COOKIE, type InventoryDisplay } from "@/lib/inventory/constants";

/** Liste oder Tabelle im Bestand (nur Desktop). Die Wahl merkt sich ein Cookie. */
export function AssetViewToggle({ value }: { value: InventoryDisplay }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const change = (next: InventoryDisplay) => {
    document.cookie = `${INVENTORY_VIEW_COOKIE}=${next}; path=/mitglieder/lager; max-age=31536000; samesite=lax`;
    const params = new URLSearchParams(searchParams.toString());
    params.set("darstellung", next);
    params.delete("seite");
    if (next === "liste") params.delete("sortierung");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <SegmentedControl
      aria-label="Darstellung"
      className="hidden lg:inline-flex"
      value={value}
      onValueChange={change}
      options={[
        {
          value: "liste",
          label: (
            <span className="inline-flex items-center gap-1.5">
              <ListIcon className="h-3.5 w-3.5" />
              Liste
            </span>
          ),
        },
        {
          value: "tabelle",
          label: (
            <span className="inline-flex items-center gap-1.5">
              <LayoutGridIcon className="h-3.5 w-3.5" />
              Tabelle
            </span>
          ),
        },
      ]}
    />
  );
}
