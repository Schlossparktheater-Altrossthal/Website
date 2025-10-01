"use client";

import * as React from "react";

import {
  MembersContentHeader,
  MembersContentLayout,
  MembersPageActions,
  MembersTopbar,
  MembersTopbarBreadcrumbs,
  MembersTopbarQuickActions,
  MembersTopbarStatus,
  MembersTopbarTitle,
  type MembersContentLayoutConfig,
} from "@/components/members/members-app-shell";
import { MembersBreadcrumbs } from "@/components/members/breadcrumbs";
import { createMembersBreadcrumbItems, type MembersBreadcrumbItem } from "@/lib/members-breadcrumbs";
import { Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { StickyBottomActions, StickyBottomActionsSpacer } from "./mobile-action-bar";

const DEFAULT_LAYOUT: MembersContentLayoutConfig = {
  width: "lg",
  padding: "relaxed",
  spacing: "comfortable",
  gap: "md",
};

export interface MembersDetailPageProps {
  title: string;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: readonly (MembersBreadcrumbItem | null | undefined | false)[] | null;
  status?: React.ReactNode;
  quickActions?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  layout?: MembersContentLayoutConfig;
  stickyCta?: React.ReactNode;
  footer?: React.ReactNode;
}

export function MembersDetailPage({
  title,
  subtitle,
  description,
  breadcrumbs,
  status,
  quickActions,
  actions,
  meta,
  sidebar,
  children,
  layout,
  stickyCta,
  footer,
}: MembersDetailPageProps) {
  const layoutConfig = React.useMemo(() => ({ ...DEFAULT_LAYOUT, ...layout }), [layout]);
  const breadcrumbItems = React.useMemo(
    () =>
      breadcrumbs
        ? createMembersBreadcrumbItems(breadcrumbs)
        : ([] as MembersBreadcrumbItem[]),
    [breadcrumbs],
  );
  const hasBreadcrumbs = breadcrumbItems.length > 0;
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
      <MembersContentLayout {...layoutConfig} />
      <MembersTopbar>
        {hasBreadcrumbs ? (
          <MembersTopbarBreadcrumbs>
            <MembersBreadcrumbs items={breadcrumbItems} />
          </MembersTopbarBreadcrumbs>
        ) : null}
        <MembersTopbarTitle>{title}</MembersTopbarTitle>
        {status ? <MembersTopbarStatus>{status}</MembersTopbarStatus> : null}
        {quickActions ? <MembersTopbarQuickActions>{quickActions}</MembersTopbarQuickActions> : null}
      </MembersTopbar>
      <MembersContentHeader className="space-y-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            {subtitle ? (
              <Text variant="eyebrow" tone="muted" uppercase className="tracking-wide">
                {subtitle}
              </Text>
            ) : null}
            <Heading level="h1" className="text-3xl sm:text-4xl">
              {title}
            </Heading>
            {descriptionNode}
          </div>
          {actions ? <MembersPageActions>{actions}</MembersPageActions> : null}
        </div>
        {meta ? <div className="grid gap-3 lg:w-[min(100%,22rem)]">{meta}</div> : null}
      </MembersContentHeader>
      <div className="space-y-6 lg:space-y-8">
        <div className={cn("grid gap-6", sidebar ? "lg:grid-cols-[minmax(0,0.68fr)_minmax(0,0.32fr)]" : undefined)}>
          <div className="space-y-6 lg:space-y-8">{children}</div>
          {sidebar ? <div className="space-y-4 lg:space-y-6">{sidebar}</div> : null}
        </div>
        {footer}
        {stickyCta ? (
          <>
            <StickyBottomActions>{stickyCta}</StickyBottomActions>
            <StickyBottomActionsSpacer />
          </>
        ) : null}
      </div>
    </>
  );
}

interface DetailPropertyListProps {
  children: React.ReactNode;
  columns?: 1 | 2;
}

export function DetailPropertyList({ children, columns = 2 }: DetailPropertyListProps) {
  return (
    <dl
      className={cn(
        "grid gap-4",
        columns === 2 ? "sm:grid-cols-2" : "",
      )}
    >
      {children}
    </dl>
  );
}

interface DetailPropertyProps {
  label: React.ReactNode;
  value: React.ReactNode;
}

export function DetailProperty({ label, value }: DetailPropertyProps) {
  return (
    <div className="space-y-1.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}
