"use client";

import * as React from "react";

import { MembersBreadcrumbs } from "@/components/members/breadcrumbs";
import {
  MembersContentHeader,
  MembersPageActions,
  MembersTopbar,
  MembersTopbarBreadcrumbs,
  MembersTopbarQuickActions,
  MembersTopbarStatus,
  MembersTopbarTitle,
} from "@/components/members/members-app-shell";
import {
  createMembersBreadcrumbItems,
  type MembersBreadcrumbItem,
} from "@/lib/members-breadcrumbs";
import { Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?:
    | readonly (MembersBreadcrumbItem | null | undefined | false)[]
    | null;
  quickActions?: React.ReactNode;
  status?: React.ReactNode;
  variant?: "page" | "section";
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  quickActions,
  status,
  variant = "page",
  className,
}: PageHeaderProps) {
  const breadcrumbItems = React.useMemo(
    () =>
      breadcrumbs
        ? createMembersBreadcrumbItems(breadcrumbs)
        : ([] as MembersBreadcrumbItem[]),
    [breadcrumbs],
  );
  const hasBreadcrumbs = breadcrumbItems.length > 0;

  if (variant === "section") {
    return (
      <div
        className={cn(
          "flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6",
          className,
        )}
      >
        <div className="space-y-1.5">
          <Heading level="h2" className="text-2xl md:text-3xl">
            {title}
          </Heading>
          {description
            ? typeof description === "string"
              ? (
                  <Text tone="muted" variant="body">
                    {description}
                  </Text>
                )
              : description
            : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    );
  }

  const descriptionNode =
    description === undefined || description === null
      ? null
      : typeof description === "string"
        ? (
            <Text tone="muted" variant="body">
              {description}
            </Text>
          )
        : description;

  return (
    <>
      <MembersTopbar>
        {hasBreadcrumbs ? (
          <MembersTopbarBreadcrumbs>
            <MembersBreadcrumbs items={breadcrumbItems} />
          </MembersTopbarBreadcrumbs>
        ) : null}
        <MembersTopbarTitle>{title}</MembersTopbarTitle>
        {status ? <MembersTopbarStatus>{status}</MembersTopbarStatus> : null}
        {quickActions ? (
          <MembersTopbarQuickActions>{quickActions}</MembersTopbarQuickActions>
        ) : null}
      </MembersTopbar>
      <MembersContentHeader className={className}>
        <div className="space-y-2">
          <Heading level="h1" className="text-3xl sm:text-4xl">
            {title}
          </Heading>
          {descriptionNode}
        </div>
        {actions ? <MembersPageActions>{actions}</MembersPageActions> : null}
      </MembersContentHeader>
    </>
  );
}
