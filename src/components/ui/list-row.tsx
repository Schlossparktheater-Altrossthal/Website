import * as React from "react";
import Link from "next/link";

import { ChevronRightIcon } from "@/components/ui/action-icons";
import { cn } from "@/lib/utils";

type ListRowBaseProps = {
  /** Icon, Avatar oder Datumsblock links. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  /** Zweite Zeile in gedämpfter Schrift. */
  description?: React.ReactNode;
  /** Kurzer Wert rechts, z. B. Uhrzeit oder Status-Badge. */
  trailing?: React.ReactNode;
  /** Chevron rechts anzeigen (Standard: bei `href`/`onClick`). */
  chevron?: boolean;
  density?: "compact" | "comfortable";
  className?: string;
  "aria-current"?: "page" | "step" | "true";
};

type ListRowProps = ListRowBaseProps &
  (
    | { href: string; onClick?: never; external?: boolean }
    | { href?: never; onClick?: () => void; external?: never }
  );

/**
 * Einheitliche Listenzeile (Termine, Aufgaben, Einstellungen). Gut mit dem Daumen
 * treffbar: mindestens 44 px hoch in der Standarddichte.
 */
export function ListRow({
  leading,
  title,
  description,
  trailing,
  chevron,
  density = "comfortable",
  className,
  href,
  onClick,
  external,
  "aria-current": ariaCurrent,
}: ListRowProps) {
  const interactive = Boolean(href || onClick);
  const showChevron = chevron ?? interactive;
  const classes = cn(
    "flex w-full items-center gap-3 rounded-md px-3 text-left",
    density === "compact" ? "min-h-10 py-1.5" : "min-h-12 py-2.5",
    interactive &&
      "transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );
  const content = (
    <>
      {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        {description ? (
          <span className="block truncate text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
      {trailing ? (
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {trailing}
        </span>
      ) : null}
      {showChevron ? (
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : null}
    </>
  );

  if (href) {
    return external ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {content}
      </a>
    ) : (
      <Link href={href} className={classes} aria-current={ariaCurrent}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
      </button>
    );
  }
  return <div className={classes}>{content}</div>;
}

/** Container für ListRows mit feinen Trennlinien. */
export function ListRowGroup({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul className={cn("divide-y divide-border/50", className)} {...props}>
      {React.Children.map(children, (child) =>
        child === null || child === undefined || child === false ? null : <li>{child}</li>,
      )}
    </ul>
  );
}
