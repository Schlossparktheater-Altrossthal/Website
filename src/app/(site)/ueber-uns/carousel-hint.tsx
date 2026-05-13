"use client";

import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const HINT_TEXT = "Auf dem Handy wischen · Mauszeiger hält Rotation an";

export function CarouselHint() {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="rounded-full p-1 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            aria-label="Karussell-Bedienhinweis"
            title={HINT_TEXT}
          >
            <Info className="h-4 w-4" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs text-xs">
          {HINT_TEXT}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
