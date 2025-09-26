"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

interface InventoryCategoryPanelProps {
  title: string;
  description: string;
  summary: string;
  defaultOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}

export function InventoryCategoryPanel({
  title,
  description,
  summary,
  defaultOpen = true,
  actions,
  children,
}: InventoryCategoryPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-content`;

  return (
    <section className="rounded-md border border-border/60 bg-background/60">
      <div className="border-b border-border/60 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <button
            type="button"
            className="flex w-full items-start justify-between gap-4 text-left"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-controls={contentId}
          >
            <div className="space-y-1">
              <h3 className="text-base font-semibold leading-6 text-foreground">
                {title}
              </h3>
              <p className="text-sm text-muted-foreground">{description}</p>
              <p className="text-sm text-muted-foreground">{summary}</p>
            </div>
            <ChevronDown
              className={cn(
                "mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                open ? "rotate-180" : "rotate-0",
              )}
            />
          </button>
          {actions ? <div className="sm:self-center">{actions}</div> : null}
        </div>
      </div>
      <div id={contentId}>{open ? children : null}</div>
    </section>
  );
}
