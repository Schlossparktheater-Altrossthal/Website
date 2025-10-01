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
  width: "xl",
  padding: "relaxed",
  spacing: "comfortable",
  gap: "md",
};

export interface WizardStep {
  id: string;
  label: string;
  description?: string;
  optional?: boolean;
}

export interface MembersWizardPageProps {
  title: string;
  description?: React.ReactNode;
  breadcrumbs?: readonly (MembersBreadcrumbItem | null | undefined | false)[] | null;
  status?: React.ReactNode;
  quickActions?: React.ReactNode;
  actions?: React.ReactNode;
  steps: readonly WizardStep[];
  activeStepId: string;
  onStepChange?: (stepId: string) => void;
  children: React.ReactNode;
  layout?: MembersContentLayoutConfig;
  stickyCta?: React.ReactNode;
  footer?: React.ReactNode;
}

export function MembersWizardPage({
  title,
  description,
  breadcrumbs,
  status,
  quickActions,
  actions,
  steps,
  activeStepId,
  onStepChange,
  children,
  layout,
  stickyCta,
  footer,
}: MembersWizardPageProps) {
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

  const currentIndex = Math.max(steps.findIndex((step) => step.id === activeStepId), 0);
  const progress = steps.length > 1 ? ((currentIndex + 1) / steps.length) * 100 : 100;

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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Heading level="h1" className="text-3xl sm:text-4xl">
              {title}
            </Heading>
            {descriptionNode}
          </div>
          {actions ? <MembersPageActions>{actions}</MembersPageActions> : null}
        </div>
        <WizardStepIndicator
          steps={steps}
          activeStepId={activeStepId}
          onStepChange={onStepChange}
          progress={progress}
        />
      </MembersContentHeader>
      <div className="space-y-6 lg:space-y-8">
        {children}
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

interface WizardStepIndicatorProps {
  steps: readonly WizardStep[];
  activeStepId: string;
  progress: number;
  onStepChange?: (stepId: string) => void;
}

function WizardStepIndicator({ steps, activeStepId, progress, onStepChange }: WizardStepIndicatorProps) {
  const activeIndex = Math.max(steps.findIndex((step) => step.id === activeStepId), 0);
  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
      <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
        <span>
          Schritt {activeIndex + 1} von {steps.length}
        </span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex flex-wrap gap-2">
        {steps.map((step, index) => {
          const isActive = step.id === activeStepId;
          const isCompleted = index < activeIndex;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepChange?.(step.id)}
              disabled={!onStepChange || isActive}
              className={cn(
                "flex min-w-[120px] flex-1 flex-col gap-1 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : isCompleted
                    ? "border-success/60 bg-success/10 text-success"
                    : "border-border/60 bg-background/60 text-muted-foreground",
              )}
            >
              <span className="font-semibold">{step.label}</span>
              {step.description ? (
                <span className="text-xs text-muted-foreground">{step.description}</span>
              ) : step.optional ? (
                <span className="text-xs text-muted-foreground">Optional</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
