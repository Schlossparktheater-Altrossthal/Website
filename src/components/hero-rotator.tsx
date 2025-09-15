"use client";
import Image from "next/image";
import * as React from "react";

export function HeroRotator({
  images,
  intervalMs = 10000,
  fadeMs = 1200,
}: {
  images: string[];
  intervalMs?: number;
  fadeMs?: number;
}) {
  // Use images in order to avoid hydration mismatch from random shuffling
  const [order] = React.useState(() => [...images]);
  const count = order.length;
  const [idx, setIdx] = React.useState(0); // Start with first image consistently
  const [prev, setPrev] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => {
      setPrev((p) => (p === null ? idx : (idx % count)));
      setIdx((i) => (i + 1) % count);
    }, intervalMs);
    return () => clearInterval(id);
  }, [count, intervalMs, idx]);

  // Preload the next image to leverage browser cache
  React.useEffect(() => {
    if (count <= 1) return;
    const next = order[(idx + 1) % count];
    const img = new window.Image();
    img.src = next;
  }, [idx, order, count]);

  if (count === 0) return null;

  const currentSrc = order[idx];
  const prevSrc = prev != null ? order[prev] : null;

  return (
    <div className="absolute inset-0 -z-10">
      {prevSrc && <Frame src={prevSrc} fadeMs={fadeMs} visible={false} priority={false} />}
      <Frame src={currentSrc} fadeMs={fadeMs} visible={true} priority={true} />
    </div>
  );
}

function Frame({
  src,
  fadeMs,
  visible,
  priority,
}: {
  src: string;
  fadeMs: number;
  visible: boolean;
  priority?: boolean;
}) {
  return (
    <div
      className="absolute inset-0 transition-opacity will-change-opacity"
      style={{ opacity: visible ? 1 : 0, transitionDuration: `${fadeMs}ms` }}
    >
      <Image
        src={src}
        alt="Hero Hintergrund"
        fill
        sizes="100vw"
        priority={priority}
        className="object-cover blur-2xl scale-110 opacity-30"
      />
      <Image
        src={src}
        alt="Hero"
        fill
        sizes="100vw"
        priority={priority}
        className="object-cover brightness-110 contrast-105"
      />
    </div>
  );
}
