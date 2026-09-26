import { ROLE_BADGE_VARIANTS, ROLE_LABELS, sortRoles, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

/**
 * Einheitliche Rollen-Chips (System- und eigene Rollen) mit deutschen Labels. `max` kürzt
 * auf „+n“, `hideMember` blendet die Basisrolle „Mitglied“ aus, solange es weitere gibt.
 */
export function RoleChips({
  roles,
  customRoles = [],
  max,
  hideMember = false,
  className,
}: {
  roles: Role[];
  customRoles?: { id: string; name: string }[];
  max?: number;
  hideMember?: boolean;
  className?: string;
}) {
  const sorted = sortRoles(roles);
  const visibleRoles =
    hideMember && (sorted.length > 1 || customRoles.length > 0)
      ? sorted.filter((role) => role !== "member")
      : sorted;
  const chips = [
    ...visibleRoles.map((role) => ({
      key: role,
      label: ROLE_LABELS[role] ?? role,
      className: ROLE_BADGE_VARIANTS[role],
    })),
    ...customRoles.map((role) => ({
      key: role.id,
      label: role.name,
      className: "border border-border/60 bg-secondary/10 text-foreground",
    })),
  ];
  if (hideMember && chips.length === 1 && chips[0].key === "member") {
    return null;
  }
  const shown = max ? chips.slice(0, max) : chips;
  const hidden = chips.slice(shown.length);

  return (
    <span className={cn("flex flex-wrap items-center gap-1", className)}>
      {shown.map((chip) => (
        <span
          key={chip.key}
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs leading-4",
            chip.className,
          )}
        >
          {chip.label}
        </span>
      ))}
      {hidden.length ? (
        <span
          className="text-xs text-muted-foreground"
          title={hidden.map((chip) => chip.label).join(", ")}
        >
          +{hidden.length}
        </span>
      ) : null}
    </span>
  );
}
