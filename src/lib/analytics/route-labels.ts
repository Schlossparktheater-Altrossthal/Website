import {
  membersNavigation,
  type MembersNavGroup,
  type MembersNavItem,
} from "@/config/members-navigation";

// Lesbare Seitennamen für die Statistik: Menübezeichnung statt Pfad, Unterseiten mit Restpfad.

const NAV_ITEMS: MembersNavItem[] = (membersNavigation as readonly MembersNavGroup[]).flatMap(
  (group) => [...group.items, ...(group.subgroups ?? []).flatMap((subgroup) => subgroup.items)],
);

const SEGMENT_LABELS: Record<string, string> = { "[id]": "Detail" };

export function routeLabel(route: string): string {
  let best: MembersNavItem | null = null;
  for (const item of NAV_ITEMS) {
    const matches = route === item.href || route.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.href.length)) best = item;
  }
  if (!best) return route.replace(/^\/mitglieder/, "") || "Dashboard";
  const rest = route
    .slice(best.href.length)
    .split("/")
    .filter(Boolean)
    .map((segment) => SEGMENT_LABELS[segment] ?? segment.replace(/-/g, " "));
  return rest.length ? `${best.label} › ${rest.join(" › ")}` : best.label;
}
