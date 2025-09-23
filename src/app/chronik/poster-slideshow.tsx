"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type PosterSlideshowProps = {
  sources: string[];
  alt: string;
  priority?: boolean;
  intervalMs?: number;
  className?: string;
};

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    mediaQuery.addEventListener?.("change", handler);

    return () => mediaQuery.removeEventListener?.("change", handler);
  }, []);

  return prefersReducedMotion;
}

export function PosterSlideshow({
  sources,
  alt,
  priority = false,
  intervalMs = 8000,
  className,
}: PosterSlideshowProps) {
  const sanitizedSources = useMemo(() => {
    const unique = new Set<string>();
    return sources
      .map((src) => (typeof src === "string" ? src.trim() : ""))
      .filter((src) => {
        if (!src) return false;
        if (unique.has(src)) return false;
        unique.add(src);
        return true;
      });
  }, [sources]);

  const prefersReducedMotion = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (activeIndex >= sanitizedSources.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, sanitizedSources.length]);

  useEffect(() => {
    if (sanitizedSources.length <= 1 || prefersReducedMotion) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % sanitizedSources.length);
    }, Math.max(intervalMs, 2000));

    return () => window.clearInterval(interval);
  }, [sanitizedSources.length, prefersReducedMotion, intervalMs]);

  if (sanitizedSources.length === 0) {
    return null;
  }

  return (
    <div className={cn("absolute inset-0", className)}>
      {sanitizedSources.map((src, index) => (
        <Image
          key={`${src}-${index}`}
          src={src}
          alt={alt}
          fill
          sizes="100vw"
          priority={priority && index === 0}
          className={cn(
            "object-cover transition-opacity duration-1000 ease-in-out",
            index === activeIndex ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
    </div>
  );
}

