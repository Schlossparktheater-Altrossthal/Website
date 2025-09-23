import type { ReactNode } from "react";

import { findMembersNavigationItem } from "@/lib/members-navigation";

export interface MembersBreadcrumbItem {
  id?: string;
  label: ReactNode;
  href?: string | null;
  icon?: ReactNode;
  isCurrent?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function isMembersBreadcrumbItem(
  value: MembersBreadcrumbItem | null | undefined | false,
): value is MembersBreadcrumbItem {
  return Boolean(value);
}

export function createMembersBreadcrumbItems(
  items: readonly (MembersBreadcrumbItem | null | undefined | false)[],
): MembersBreadcrumbItem[] {
  return items.filter(isMembersBreadcrumbItem);
}

export function membersNavigationBreadcrumb(
  href: string,
  options?: { label?: ReactNode; ariaLabel?: string },
): MembersBreadcrumbItem | null {
  const match = findMembersNavigationItem(href);
  if (!match) {
    return null;
  }

  return {
    id: match.item.href,
    label: options?.label ?? match.item.label,
    href: match.item.href,
    ariaLabel: options?.ariaLabel ?? match.item.ariaLabel,
  };
}
