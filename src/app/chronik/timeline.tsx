"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type ChronikItem = {
  id: string;
  year: number;
  title?: string | null;
};

export function ChronikTimeline({ items }: { items: ChronikItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  useEffect(() => {
    let scrollTimeout: ReturnType<typeof setTimeout> | undefined;

    const handleScroll = () => {
      setIsUserScrolling(true);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => setIsUserScrolling(false), 150);
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, []);

  useEffect(() => {
    if (isUserScrolling) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting && entry.intersectionRatio > 0.4)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length > 0) {
          const newActiveId = visible[0].target.id;
          if (newActiveId !== activeId) setActiveId(newActiveId);
        }
      },
      {
        threshold: [0.4, 0.6, 0.8],
        rootMargin: "-20% 0px -20% 0px",
      },
    );

    items.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [items, activeId, isUserScrolling]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const activeIndex = useMemo(
    () => items.findIndex((item) => item.id === activeId),
    [items, activeId],
  );

  const completion = useMemo(() => {
    if (items.length === 0 || activeIndex === -1) return 100;
    return Math.max(8, ((items.length - activeIndex) / items.length) * 100);
  }, [items.length, activeIndex]);

  const reversedItems = useMemo(() => [...items].reverse(), [items]);

  return (
    <div className="px-4 pb-12 sm:px-0 sm:pb-0">
      <div className="relative w-full sm:fixed sm:bottom-8 sm:left-1/2 sm:z-40 sm:w-auto sm:-translate-x-1/2 sm:transform">
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-background/80 px-5 py-4 shadow-xl backdrop-blur-lg sm:rounded-2xl sm:px-8">
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 sm:rounded-2xl" />
          <div className="pointer-events-none absolute top-2 left-4 right-4 h-0.5 rounded-full bg-border/60" />
          <div
            className="pointer-events-none absolute top-2 left-4 h-0.5 rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500 ease-out"
            style={{ width: `${completion}%` }}
          />

          <div className="relative flex items-center gap-4 overflow-x-auto px-1 pt-3 scrollbar-hide sm:max-w-[85vw]">
            {reversedItems.map((item) => {
              const isActive = item.id === activeId;
              const originalIndex = items.findIndex((entry) => entry.id === item.id);
              const isPast = activeIndex !== -1 && originalIndex > activeIndex;

              return (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={cn(
                    "group relative m-1 flex min-w-fit flex-col items-center gap-2 rounded-lg p-3 transition-all duration-300 hover:scale-105 focus:outline-none",
                    isActive ? "ring-2 ring-primary/70" : "ring-1 ring-border/50",
                  )}
                  title={item.title || `Saison ${item.year}`}
                >
                  <div className="relative">
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full border-2 transition-all duration-500",
                        isActive && "scale-110 border-primary bg-primary shadow-lg shadow-primary/40",
                        !isActive &&
                          (isPast
                            ? "border-primary/50 bg-primary/40 shadow-md shadow-primary/25"
                            : "border-border/60 bg-transparent group-hover:scale-110 group-hover:border-primary group-hover:bg-primary/15"),
                      )}
                    />
                    {isActive && (
                      <>
                        <div className="absolute inset-0 h-4 w-4 animate-ping rounded-full bg-primary/20" />
                        <div className="absolute inset-0 h-4 w-4 scale-150 animate-pulse rounded-full bg-primary/10" />
                      </>
                    )}
                  </div>

                  <span
                    className={cn(
                      "text-sm font-semibold transition-all duration-300",
                      isActive && "scale-105 text-primary",
                      !isActive && (isPast ? "text-primary/80" : "text-muted-foreground group-hover:scale-105 group-hover:text-foreground"),
                    )}
                  >
                    {item.year}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
