"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const ACTION_WIDTH = 112;
const ACTION_GAP = 8;

export interface SwipeActionDefinition {
  id: string;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "primary" | "destructive";
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
}

interface SwipeActionListProps {
  children: React.ReactNode;
  className?: string;
}

export function SwipeActionsList({ children, className }: SwipeActionListProps) {
  return (
    <div className={cn("[--swipe-actions-gap:1rem] space-y-[var(--swipe-actions-gap)]", className)}>{children}</div>
  );
}

export interface SwipeActionsItemProps {
  actions?: readonly (SwipeActionDefinition | null | false | undefined)[];
  children: React.ReactNode;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

export function SwipeActionsItem({ actions, children, className, onOpenChange }: SwipeActionsItemProps) {
  const router = useRouter();
  const actionList = React.useMemo(
    () => (actions ?? []).filter((item): item is SwipeActionDefinition => Boolean(item)),
    [actions],
  );
  const hasActions = actionList.length > 0;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const dragState = React.useRef<{
    pointerId: number | null;
    startX: number;
    originOffset: number;
    isDragging: boolean;
  }>({ pointerId: null, startX: 0, originOffset: 0, isDragging: false });

  const maxOffset = React.useMemo(() => {
    if (!hasActions) return 0;
    return actionList.length * (ACTION_WIDTH + ACTION_GAP);
  }, [actionList.length, hasActions]);

  React.useEffect(() => {
    if (!hasActions) return;
    setOffset(open ? -maxOffset : 0);
  }, [open, hasActions, maxOffset]);

  React.useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const close = React.useCallback(() => {
    setOpen(false);
    setOffset(0);
  }, []);

  React.useEffect(() => {
    if (!hasActions) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current) return;
      if (!event.isPrimary) return;
      if (!(event.target instanceof Element)) return;
      if (!containerRef.current.contains(event.target)) return;
      dragState.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        originOffset: open ? -maxOffset : 0,
        isDragging: false,
      };
      containerRef.current.setPointerCapture(event.pointerId);
    }

    function handlePointerMove(event: PointerEvent) {
      if (dragState.current.pointerId !== event.pointerId) return;
      const delta = event.clientX - dragState.current.startX;
      const next = Math.min(0, Math.max(-maxOffset, dragState.current.originOffset + delta));
      if (Math.abs(delta) > 4) {
        dragState.current.isDragging = true;
      }
      setOffset(next);
    }

    function settleOffset(event: PointerEvent) {
      if (dragState.current.pointerId !== event.pointerId) return;
      const delta = event.clientX - dragState.current.startX;
      const shouldOpen = dragState.current.isDragging
        ? delta < -32 || dragState.current.originOffset === -maxOffset
        : open;
      setOpen(shouldOpen && hasActions);
      setOffset(shouldOpen && hasActions ? -maxOffset : 0);
      if (containerRef.current) {
        try {
          containerRef.current.releasePointerCapture(event.pointerId);
        } catch {
          // ignore
        }
      }
      dragState.current = { pointerId: null, startX: 0, originOffset: 0, isDragging: false };
    }

    const node = containerRef.current;
    if (!node) return;
    node.addEventListener("pointerdown", handlePointerDown);
    node.addEventListener("pointermove", handlePointerMove);
    node.addEventListener("pointerup", settleOffset);
    node.addEventListener("pointercancel", settleOffset);

    return () => {
      node.removeEventListener("pointerdown", handlePointerDown);
      node.removeEventListener("pointermove", handlePointerMove);
      node.removeEventListener("pointerup", settleOffset);
      node.removeEventListener("pointercancel", settleOffset);
    };
  }, [hasActions, maxOffset, open]);

  React.useEffect(() => {
    if (!hasActions) return;
    function handleDocumentPointerDown(event: PointerEvent) {
      if (!containerRef.current) return;
      if (!(event.target instanceof Node)) return;
      if (containerRef.current.contains(event.target)) return;
      close();
    }
    document.addEventListener("pointerdown", handleDocumentPointerDown);
    return () => document.removeEventListener("pointerdown", handleDocumentPointerDown);
  }, [close, hasActions]);

  function renderActions() {
    return (
      <div
        aria-hidden={!open}
        className="absolute inset-y-0 right-0 flex items-center gap-2 px-2"
      >
        {actionList.map((action) => {
          const toneClass =
            action.tone === "destructive"
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : action.tone === "primary"
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground hover:bg-muted/80";
          const content = (
            <Button
              asChild={Boolean(action.href)}
              type={action.href ? undefined : "button"}
              variant="secondary"
              size="sm"
              disabled={action.disabled}
              className={cn("h-12 min-w-[96px] whitespace-nowrap px-4", toneClass)}
              onClick={
                action.href
                  ? undefined
                  : () => {
                      action.onSelect?.();
                      close();
                    }
              }
            >
              {action.href ? (
                <Link href={action.href} onClick={close}>
                  {action.label}
                </Link>
              ) : (
                action.label
              )}
            </Button>
          );
          if (!action.href) {
            return (
              <div key={action.id} className="flex-1">
                {content}
              </div>
            );
          }
          return (
            <div key={action.id} className="flex-1">
              {content}
            </div>
          );
        })}
      </div>
    );
  }

  const menuActions = actionList.filter((action) => action.href || action.onSelect);
  const dropdownItems: React.ComponentProps<typeof DropdownMenu>["items"] = menuActions.map((action) => ({
    label: typeof action.label === "string" ? action.label : "Aktion",
    icon: <span className="h-2 w-2 rounded-full bg-muted-foreground/60" aria-hidden />,
    variant: action.tone === "destructive" ? "destructive" : "default",
    onClick: () => {
      if (action.href) {
        router.push(action.href);
      } else {
        action.onSelect?.();
      }
      close();
    },
  }));

  return (
    <div className={cn("relative touch-pan-y", className)} ref={containerRef}>
      {hasActions ? renderActions() : null}
      <div
        className="relative will-change-transform"
        style={{ transform: `translate3d(${offset}px,0,0)` }}
      >
        <div className="group rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm shadow-black/5">
          {children}
          {dropdownItems.length ? (
            <div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted-foreground">
              <span>Aktionen</span>
              <DropdownMenu items={dropdownItems} align="right" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
