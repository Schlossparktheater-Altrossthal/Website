"use client";

import * as React from "react";
import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";

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
  width: "xl",
  padding: "relaxed",
  spacing: "comfortable",
  gap: "md",
};

export interface MembersListPageProps {
  title: string;
  description?: React.ReactNode;
  breadcrumbs?: readonly (MembersBreadcrumbItem | null | undefined | false)[] | null;
  status?: React.ReactNode;
  quickActions?: React.ReactNode;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  children: React.ReactNode;
  layout?: MembersContentLayoutConfig;
  stickyCta?: React.ReactNode;
  className?: string;
}

export function MembersListPage({
  title,
  description,
  breadcrumbs,
  status,
  quickActions,
  actions,
  filters,
  children,
  layout,
  stickyCta,
  className,
}: MembersListPageProps) {
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
      <MembersContentHeader className="space-y-4">
        <div className={cn("flex flex-col gap-3", className)}>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <Heading level="h1" className="text-3xl sm:text-4xl">
                {title}
              </Heading>
              {descriptionNode}
            </div>
            {actions ? <MembersPageActions>{actions}</MembersPageActions> : null}
          </div>
          {filters ? <div className="-mx-0.5 flex flex-col gap-2">{filters}</div> : null}
        </div>
      </MembersContentHeader>
      <div className="space-y-4 lg:space-y-6">
        {children}
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

interface FilterChipsProps {
  children: React.ReactNode;
  className?: string;
  label?: React.ReactNode;
}

export function FilterChips({ children, className, label }: FilterChipsProps) {
  return (
    <div className="flex flex-col gap-2">
      {label ? <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span> : null}
      <div className={cn("flex flex-wrap gap-2", className)}>{children}</div>
    </div>
  );
}

interface FilterChipBaseProps {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  icon?: React.ReactNode;
}

type FilterChipButtonProps = FilterChipBaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
  };

type FilterChipLinkProps = FilterChipBaseProps &
  Omit<React.ComponentPropsWithoutRef<typeof Link>, "className" | "children"> & {
    href: string;
    asChild?: never;
  };

export type FilterChipProps = FilterChipButtonProps | FilterChipLinkProps;

function isFilterChipLinkProps(props: FilterChipProps): props is FilterChipLinkProps {
  return typeof (props as FilterChipLinkProps).href === "string";
}

export function FilterChip(props: FilterChipProps) {
  if (isFilterChipLinkProps(props)) {
    const { href, className, active = false, icon, children, ...linkProps } = props;
    const classes = cn(
      "inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1 text-sm font-medium transition-colors",
      "hover:border-primary/60 hover:text-primary data-[active=true]:border-primary data-[active=true]:bg-primary/10",
      "data-[active=true]:text-primary",
      className,
    );
    return (
      <Link href={href} className={classes} data-active={active} {...linkProps}>
        {icon ? <span className="text-base leading-none">{icon}</span> : null}
        <span className="truncate">{children}</span>
      </Link>
    );
  }

  const { asChild = false, className, active = false, icon, children, type: buttonTypeProp, ...buttonProps } = props;
  const classes = cn(
    "inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1 text-sm font-medium transition-colors",
    "hover:border-primary/60 hover:text-primary data-[active=true]:border-primary data-[active=true]:bg-primary/10",
    "data-[active=true]:text-primary",
    className,
  );
  const content = (
    <>
      {icon ? <span className="text-base leading-none">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </>
  );

  if (asChild) {
    return (
      <Slot className={classes} data-active={active} {...buttonProps}>
        {content}
      </Slot>
    );
  }

  const buttonType = (buttonTypeProp ?? "button") as React.ButtonHTMLAttributes<HTMLButtonElement>["type"];

  return (
    <button type={buttonType} className={classes} data-active={active} {...buttonProps}>
      {content}
    </button>
  );
}
