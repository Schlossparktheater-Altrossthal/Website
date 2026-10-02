import { SectionNav } from "@/components/ui/section-nav";
import { INVENTORY_BASE_PATH } from "@/lib/inventory/constants";

export type LagerSection =
  | "uebersicht"
  | "scannen"
  | "inventur"
  | "ausgaben"
  | "pruefungen"
  | "orte"
  | "etiketten"
  | "einstellungen";

// Höchstens sechs Einträge, damit die Pills auch auf Tablets in eine Zeile passen. Etiketten
// und Bereiche erreicht man über Schaltflächen im Bestand.
const SECTIONS: { id: LagerSection; label: string; path: string; manageOnly?: boolean }[] = [
  { id: "uebersicht", label: "Bestand", path: "" },
  { id: "scannen", label: "Scannen", path: "/scannen" },
  { id: "ausgaben", label: "Ausgaben", path: "/ausgaben" },
  { id: "inventur", label: "Inventur", path: "/inventur" },
  { id: "pruefungen", label: "Prüfungen", path: "/pruefungen" },
  { id: "orte", label: "Orte", path: "/orte" },
];

/** Bereichs-Navigation des Lagers (Select auf dem Handy, Pills ab `sm`). */
export function LagerNav({ active, canManage }: { active: LagerSection; canManage: boolean }) {
  const items = SECTIONS.filter((section) => canManage || !section.manageOnly).map((section) => ({
    id: section.id,
    label: section.label,
    href: `${INVENTORY_BASE_PATH}${section.path}`,
  }));
  return <SectionNav items={items} activeId={active} ariaLabel="Lagerbereiche" />;
}
