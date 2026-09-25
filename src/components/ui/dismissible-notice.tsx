"use client";

import * as React from "react";
import { toast } from "sonner";

import { XIcon } from "@/components/ui/action-icons";
import { cn } from "@/lib/utils";

type NoticeTone = "info" | "primary" | "success" | "warning";

const TONE_CLASSES: Record<NoticeTone, string> = {
  info: "border-info/30 bg-info/10",
  primary: "border-primary/30 bg-primary/5",
  success: "border-success/30 bg-success/10",
  warning: "border-warning/40 bg-warning/10",
};

const ICON_CLASSES: Record<NoticeTone, string> = {
  info: "bg-info/15 text-info",
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning",
};

type DismissibleNoticeProps = {
  /** Schlüssel für die serverseitige Ausblendung (`/api/notices/dismiss`). */
  noticeKey: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** Hauptaktion, z. B. ein Button oder Link. */
  action?: React.ReactNode;
  tone?: NoticeTone;
  onDismissed?: () => void;
  className?: string;
};

/** Kompakter Hinweis mit Schließen-Knopf; bleibt nach dem Ausblenden auf allen Geräten weg. */
export function DismissibleNotice({
  noticeKey,
  title,
  description,
  icon,
  action,
  tone = "info",
  onDismissed,
  className,
}: DismissibleNoticeProps) {
  const [hidden, setHidden] = React.useState(false);

  const handleDismiss = React.useCallback(async () => {
    setHidden(true);
    try {
      const response = await fetch("/api/notices/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: noticeKey }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      onDismissed?.();
    } catch (error) {
      console.error("[dismissible-notice]", error);
      setHidden(false);
      toast.error("Hinweis konnte nicht ausgeblendet werden.");
    }
  }, [noticeKey, onDismissed]);

  if (hidden) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 text-sm",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {icon ? (
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md [&>svg]:h-4 [&>svg]:w-4",
            ICON_CLASSES[tone],
          )}
          aria-hidden
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug text-foreground">{title}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
      <button
        type="button"
        onClick={() => void handleDismiss()}
        className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Hinweis ausblenden"
        title="Nicht mehr anzeigen"
      >
        <XIcon className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
