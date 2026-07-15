"use client";

import { MoreVerticalIcon } from "@/components/ui/action-icons";

import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ActionMenuItem = {
  label: string;
  icon?: React.ReactNode;
  onSelect?: () => void;
  onClick?: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
};

type ActionDropdownMenuProps = {
  items: ActionMenuItem[];
  align?: React.ComponentProps<typeof DropdownMenuContent>["align"];
  className?: string;
  label?: string;
};

export function ActionDropdownMenu({
  items,
  align = "end",
  className,
  label = "Aktionen öffnen",
}: ActionDropdownMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-background/90 text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <MoreVerticalIcon className="h-4 w-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        {items.map((item) => {
          const handleSelect = item.onSelect ?? item.onClick;
          return (
            <DropdownMenuItem
              key={item.label}
              onSelect={(event) => {
                event.preventDefault();
                if (!item.disabled && handleSelect) {
                  handleSelect();
                }
              }}
              disabled={item.disabled}
              className={cn(
                "flex items-center gap-2",
                item.variant === "destructive" && "text-destructive focus:text-destructive",
              )}
            >
              {item.icon ? <span className="text-muted-foreground">{item.icon}</span> : null}
              <span className="truncate">{item.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
