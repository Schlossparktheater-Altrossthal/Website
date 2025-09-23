"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

type SchulkatzeImageRotatorProps = {
  images: string[];
  alt: string;
  interval?: number;
  sizes?: string;
  className?: string;
};

const DEFAULT_INTERVAL = 6000;
const MINIMUM_INTERVAL = 2000;
const DEFAULT_SIZES = "(min-width: 1024px) 320px, (min-width: 768px) 40vw, 90vw";

export function SchulkatzeImageRotator({
  images,
  alt,
  interval = DEFAULT_INTERVAL,
  sizes = DEFAULT_SIZES,
  className,
}: SchulkatzeImageRotatorProps) {
  const validImages = useMemo(
    () =>
      Array.from(
        new Set(
          images.filter((src) => typeof src === "string" && src.trim().length > 0)
        )
      ),
    [images]
  );
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(0);
  }, [validImages.length]);

  useEffect(() => {
    if (validImages.length <= 1) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (mediaQuery.matches) {
      return;
    }

    const rotationInterval = window.setInterval(() => {
      setCurrentIndex((previousIndex) => {
        const nextIndex = previousIndex + 1;
        return nextIndex >= validImages.length ? 0 : nextIndex;
      });
    }, Math.max(MINIMUM_INTERVAL, interval));

    return () => {
      window.clearInterval(rotationInterval);
    };
  }, [validImages.length, interval]);

  if (validImages.length === 0) {
    return null;
  }

  return (
    <div className={cn("relative aspect-[3/4] w-full", className)}>
      {validImages.map((src, index) => (
        <Image
          key={src}
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={index === 0}
          className={cn(
            "object-cover transition-opacity duration-700 ease-in-out",
            index === currentIndex ? "opacity-100" : "opacity-0"
          )}
          aria-hidden={index !== currentIndex}
        />
      ))}
    </div>
  );
}
