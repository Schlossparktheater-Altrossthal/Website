"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { decideJoinRequestAction } from "@/app/(members)/mitglieder/produktionen/actions/assignments";
import {
  AlertTriangleIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  BellIcon,
  CalendarIcon,
  CameraIcon,
  CheckIcon,
  ChevronDownIcon,
  ClapperboardIcon,
  DramaIcon,
  UsersRoundIcon,
} from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_LABELS,
  firstLine,
  formatNotificationTime,
  groupTitle,
} from "@/lib/notifications/format";
import type { InboxGroup, InboxItem, InboxStateAction } from "@/lib/notifications/inbox-shared";
import { NOTIFICATION_TYPES, type NotificationCategory } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

import type { InboxTarget } from "./use-inbox";

export type InboxUpdate = (action: InboxStateAction, target: InboxTarget) => Promise<void>;

const CATEGORY_TONES: Record<NotificationCategory, string> = {
  proben: "bg-primary/12 text-primary",
  termine: "bg-info/12 text-info",
  gewerke: "bg-warning/15 text-warning",
  produktion: "bg-success/12 text-success",
  system: "bg-muted text-muted-foreground",
};

function GroupIcon({ group }: { group: InboxGroup }) {
  const { latest } = group;
  const urgent = group.priority === "urgent" && group.section !== "earlier";
  let icon: React.ReactNode;
  switch (latest.type) {
    case NOTIFICATION_TYPES.REHEARSAL_ATTENDANCE:
    case NOTIFICATION_TYPES.REHEARSAL_EMERGENCY:
      icon = <AlertTriangleIcon />;
      break;
    case NOTIFICATION_TYPES.DEPARTMENT_REQUEST:
      icon = <UsersRoundIcon />;
      break;
    case NOTIFICATION_TYPES.PHOTO_CONSENT:
      icon = <CameraIcon />;
      break;
    default:
      // Gewerk-Benachrichtigungen öffnen „Meine Teams“ und tragen deshalb dessen Symbol
      // (docs/Plan/seiten-icons-plan.md); die übrigen Kategorien beschreiben das Ereignis selbst.
      icon = {
        proben: <DramaIcon />,
        termine: <CalendarIcon />,
        gewerke: <UsersRoundIcon />,
        produktion: <ClapperboardIcon />,
        system: <BellIcon />,
      }[group.category];
  }
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md [&>svg]:h-4 [&>svg]:w-4",
        urgent ? "bg-destructive/15 text-destructive" : CATEGORY_TONES[group.category],
      )}
      aria-hidden
    >
      {icon}
    </span>
  );
}

export function groupTarget(group: InboxGroup): InboxTarget {
  return group.latest.groupKey
    ? { groupKeys: [group.latest.groupKey] }
    : { ids: group.items.map((item) => item.id) };
}

function joinRequest(item: InboxItem) {
  if (item.type !== NOTIFICATION_TYPES.DEPARTMENT_REQUEST || item.doneAt) return null;
  const data = item.data as { departmentId?: unknown; requesterId?: unknown } | null;
  return typeof data?.departmentId === "string" && typeof data.requesterId === "string"
    ? { departmentId: data.departmentId, userId: data.requesterId }
    : null;
}

function JoinRequestActions({ item, onDecided }: { item: InboxItem; onDecided: () => void }) {
  const request = joinRequest(item);
  const [pending, setPending] = React.useState<"accept" | "decline" | null>(null);
  if (!request) return null;

  const decide = async (accept: boolean) => {
    setPending(accept ? "accept" : "decline");
    const result = await decideJoinRequestAction({ ...request, accept }).catch(() => ({
      ok: false as const,
      error: "Das hat nicht geklappt.",
    }));
    setPending(null);
    if (result.ok) toast.success(accept ? "Anfrage angenommen" : "Anfrage abgelehnt");
    else toast.error(result.error);
    onDecided();
  };

  return (
    <div className="flex gap-2">
      <AsyncButton
        size="sm"
        variant="outline"
        isLoading={pending === "decline"}
        loadingText="Lehne ab…"
        disabled={Boolean(pending)}
        onClick={() => decide(false)}
      >
        Ablehnen
      </AsyncButton>
      <AsyncButton
        size="sm"
        isLoading={pending === "accept"}
        loadingText="Nehme an…"
        disabled={Boolean(pending)}
        onClick={() => decide(true)}
      >
        Annehmen
      </AsyncButton>
    </div>
  );
}

const SWIPE_TRIGGER = 72;

type NotificationRowProps = {
  group: InboxGroup;
  update: InboxUpdate;
  /** Beim Folgen eines Links, z. B. um die Glocke zu schließen. */
  onNavigate?: () => void;
  /** Ansicht des Archivs: Zurückholen statt Archivieren. */
  archived?: boolean;
};

/**
 * Eine Zeile pro Benachrichtigung bzw. Bündel. Klick öffnet das Ziel, Bündel lassen sich
 * aufklappen. Am Desktop erscheinen Knöpfe beim Überfahren, mobil wischt man nach links.
 */
export function NotificationRow({ group, update, onNavigate, archived }: NotificationRowProps) {
  const { latest } = group;
  const [expanded, setExpanded] = React.useState(false);
  const [offset, setOffset] = React.useState(0);
  const swipe = React.useRef<{ x: number; y: number; active: boolean } | null>(null);
  const target = groupTarget(group);
  const unread = group.unreadCount > 0;
  const isOpenAction = group.section === "action";
  const title = groupTitle(group);
  const description = firstLine(latest.body);
  const expandId = React.useId();

  const primary = React.useCallback(() => {
    if (archived) {
      void update("unarchive", target);
      return;
    }
    const action: InboxStateAction = isOpenAction ? "done" : "archive";
    void update(action, target);
    toast(isOpenAction ? "Als erledigt markiert" : "Archiviert", {
      action: {
        label: "Rückgängig",
        onClick: () => void update(isOpenAction ? "undone" : "unarchive", target),
      },
    });
  }, [archived, isOpenAction, target, update]);

  const markRead = () => {
    if (unread) void update("read", target);
    onNavigate?.();
  };

  const pointer = {
    onPointerDown: (event: React.PointerEvent) => {
      if (event.pointerType !== "touch") return;
      swipe.current = { x: event.clientX, y: event.clientY, active: false };
    },
    onPointerMove: (event: React.PointerEvent) => {
      const start = swipe.current;
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!start.active) {
        if (Math.abs(dy) > 10) {
          swipe.current = null;
          return;
        }
        if (dx < -10) start.active = true;
      }
      if (start.active) setOffset(Math.min(0, Math.max(dx, -120)));
    },
    onPointerUp: () => {
      if (swipe.current?.active && offset <= -SWIPE_TRIGGER) primary();
      swipe.current = null;
      setOffset(0);
    },
    onPointerCancel: () => {
      swipe.current = null;
      setOffset(0);
    },
  };

  const meta = (
    <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      <time dateTime={latest.createdAt}>{formatNotificationTime(latest.createdAt)}</time>
      <span aria-hidden>·</span>
      <span>{CATEGORY_LABELS[group.category]}</span>
    </span>
  );

  const body = (
    <>
      <span
        className={cn(
          "line-clamp-2 text-sm leading-snug text-foreground",
          unread || isOpenAction ? "font-semibold" : "font-medium",
        )}
      >
        {title}
      </span>
      {description ? (
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span>
      ) : null}
      <span className="mt-1 block">{meta}</span>
    </>
  );

  return (
    <div className="relative overflow-hidden rounded-md" data-notification-group={group.key}>
      {offset < 0 ? (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-end gap-2 px-4 text-sm font-medium",
            isOpenAction ? "bg-success/15 text-success" : "bg-muted text-foreground",
          )}
          aria-hidden
        >
          {isOpenAction ? <CheckIcon /> : <ArchiveIcon />}
          {isOpenAction ? "Erledigt" : "Archivieren"}
        </div>
      ) : null}
      <div
        className={cn(
          "group relative flex gap-3 px-3 py-2.5 transition-[background-color] hover:bg-muted/50 focus-within:bg-muted/50",
          // Beim Wischen deckt die Zeile den Hintergrund mit der Aktion ab.
          offset === 0 ? "transition-transform" : "bg-card",
        )}
        style={offset ? { transform: `translateX(${offset}px)` } : undefined}
        {...pointer}
      >
        <GroupIcon group={group} />
        <div className="min-w-0 flex-1">
          {latest.actionUrl ? (
            <Link
              href={latest.actionUrl}
              onClick={markRead}
              className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-notification-link
            >
              {body}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => (unread ? void update("read", target) : undefined)}
              className="block w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-notification-link
            >
              {body}
            </button>
          )}

          {!archived && isOpenAction ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {joinRequest(latest) ? (
                <JoinRequestActions item={latest} onDecided={() => void update("done", target)} />
              ) : (
                <Button size="sm" variant="outline" onClick={primary}>
                  <CheckIcon className="h-3.5 w-3.5" />
                  Erledigt
                </Button>
              )}
            </div>
          ) : null}

          {group.count > 1 ? (
            <button
              type="button"
              className="mt-1.5 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={expanded}
              aria-controls={expandId}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? "Weniger" : `Alle ${group.count} anzeigen`}
              <ChevronDownIcon
                className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
              />
            </button>
          ) : null}
          {expanded ? (
            <ul id={expandId} className="mt-2 space-y-2 border-l-2 border-border pl-3">
              {group.items.map((item) => (
                <li key={item.id} className="text-xs">
                  <p className={cn("text-foreground", !item.readAt && "font-semibold")}>
                    {item.title}
                  </p>
                  {item.body ? (
                    <p className="whitespace-pre-line text-muted-foreground">{item.body}</p>
                  ) : null}
                  <time dateTime={item.createdAt} className="text-muted-foreground">
                    {formatNotificationTime(item.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {unread ? (
            <span className="mt-1.5 h-2 w-2 rounded-full bg-primary" aria-label="Ungelesen" />
          ) : (
            <span className="mt-1.5 h-2 w-2" aria-hidden />
          )}
          <div className="flex gap-0.5 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:none)]:sr-only">
            {!archived && unread && !isOpenAction ? (
              <IconAction label="Als gelesen markieren" onClick={() => void update("read", target)}>
                <CheckIcon />
              </IconAction>
            ) : null}
            <IconAction
              label={archived ? "Zurückholen" : isOpenAction ? "Erledigt" : "Archivieren"}
              onClick={primary}
            >
              {archived ? <ArchiveRestoreIcon /> : isOpenAction ? <CheckIcon /> : <ArchiveIcon />}
            </IconAction>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&>svg]:h-4 [&>svg]:w-4"
    >
      {children}
    </button>
  );
}
