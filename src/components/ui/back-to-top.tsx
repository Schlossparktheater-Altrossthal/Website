"use client";

import * as React from "react";

import { ChevronUpIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const VISIBILITY_SCROLL_THRESHOLD = 300;

export function BackToTop() {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > VISIBILITY_SCROLL_THRESHOLD);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Nach oben"
      onClick={handleClick}
      className={cn(
        "fixed bottom-6 right-6 z-50 min-h-11 min-w-11 bg-background/80 opacity-0 shadow-[var(--shadow-lg)] backdrop-blur transition-opacity duration-200 sm:bottom-8 sm:right-8",
        isVisible ? "pointer-events-auto opacity-100" : "pointer-events-none"
      )}
    >
      <ChevronUpIcon className="h-5 w-5" />
    </Button>
  );
}
