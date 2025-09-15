"use client";
import Image from "next/image";
import * as React from "react";

export function HeroLayers({
  images,
  intervalMs = 8000,
  fadeMs = 1200,
}: {
  images: string[];
  intervalMs?: number;
  fadeMs?: number;
}) {
  const shuffled = React.useMemo(() => {
    const arr = [...images];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [images]);

  const count = shuffled.length;
  const [idx, setIdx] = React.useState(() => (count > 0 ? Math.floor(Math.random() * count) : 0));

  React.useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % count);
    }, intervalMs);
    return () => clearInterval(id);
  }, [count, intervalMs]);

  if (count === 0) return null;

  return (
    <div className="absolute inset-0 -z-10">
      {shuffled.map((src, i) => (
        <Image
          key={src + i}
          src={src}
          alt="Hero"
          fill
          sizes="100vw"
          priority={i === idx}
          className="object-cover transition-opacity will-change-opacity"
          style={{
            opacity: i === idx ? 1 : 0,
            transitionDuration: `${fadeMs}ms`,
          }}
        />
      ))}
    </div>
  );
}
