import type { RolePreferenceDomain } from "@prisma/client";

/** Regie/Planung dürfen jeden Bereich, die Gewerk-Leitung nur Bereiche ihrer Gewerke. */
export function canEditWishArea(
  area: { domain: RolePreferenceDomain; departmentIds: ReadonlyArray<string> },
  access: { manageAll: boolean; leadDepartmentIds: ReadonlyArray<string> },
) {
  if (access.manageAll) return true;
  if (area.domain !== "crew") return false;
  return area.departmentIds.some((id) => access.leadDepartmentIds.includes(id));
}
