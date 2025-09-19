"use client";
import Image from "next/image";
import * as React from "react";

export function HeroParallax({ src, alt = "Hero" }: { src: string; alt?: string }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [yBg, setYBg] = React.useState(0);
  const [yFg, setYFg] = React.useState(0);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let enabled = false;
    const mq = typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)") : undefined;
    const check = () => (enabled = mq ? mq.matches : false);
    check();
    mq?.addEventListener?.("change", check);

    const onScroll = () => {
      if (!enabled || !el) return;
      const rect = el.getBoundingClientRect();
      const viewportH = window.innerHeight || 0;
      // progress: 0 at top aligning, positive when scrolling down
      const progress = rect.top - viewportH / 2; // relative to mid viewport
      // small parallax factors
      setYBg(progress * -0.08);
      setYFg(progress * 0.03);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      mq?.removeEventListener?.("change", check);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div ref={ref} className="absolute inset-0 -z-10">
      {/* Blur-fill background */}
      <Image
        src={src}
        alt={alt}
        fill
        sizes="100vw"
        priority
        className="object-cover blur-2xl scale-110 opacity-60 will-change-transform"
        style={{ transform: `translateY(${yBg}px)` }}
      />
      {/* Foreground contain image */}
      <Image
        src={src}
        alt={alt}
        fill
        sizes="100vw"
        priority
        className="object-contain will-change-transform"
        style={{ transform: `translateY(${yFg}px)` }}
      />
    </div>
  );
}

