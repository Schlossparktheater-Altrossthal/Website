"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroRotator } from "@/components/hero-rotator";
import { useEffect, useState } from "react";

export function Hero({ images }: { images: string[] }) {
  const [scrollY, setScrollY] = useState(0);
  
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const rotateImages = images.length > 0 ? images.slice(0, 5) : ["https://picsum.photos/id/1069/1600/900"];
  
  return (
    <section className="hero-section relative h-screen min-h-[100dvh] w-full overflow-hidden sm:min-h-[90vh] lg:min-h-[100vh]">
      {/* Full-screen background images */}
      <div
        className="absolute inset-0 w-full h-full hero-bg z-0 pointer-events-none"
        style={{
          transform: `translateY(${scrollY * 0.5}px) scale(${1 + scrollY * 0.0005})`,
          filter: `blur(${Math.min(scrollY * 0.02, 8)}px)`,
        }}
      >
        <HeroRotator images={rotateImages} />
      </div>
      
      {/* Lighter overlays for better image visibility */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-transparent via-transparent to-background/80 pointer-events-none" />
      
      {/* Subtle mystical color overlays */}
      <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_60rem_30rem_at_30%_70%,_color-mix(in_oklab,var(--primary)_8%,transparent),transparent_80%)] pointer-events-none" />
      <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_40rem_20rem_at_70%_30%,_color-mix(in_oklab,var(--primary)_12%,transparent),transparent_75%)] mix-blend-screen opacity-40 pointer-events-none" />
      
      {/* Content container */}
      <div className="hero-content relative z-20 flex h-full items-center justify-center pt-16 pb-10">
        <div className="layout-container">
          <div
            className="mx-auto max-w-4xl text-center"
            style={{
              transform: `translateY(${scrollY * -0.3}px)`,
            }}
          >
            <div className="flex flex-col items-center gap-6 md:gap-7 lg:gap-9">
              <span className="inline-flex items-center justify-center rounded-full border border-white/30 bg-black/20 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-white/80 shadow-lg backdrop-blur">
                Sommer 2025
              </span>
              <h1 className="font-serif text-[clamp(2.4rem,6vw,4.75rem)] font-bold leading-[1.05] text-white [text-shadow:_0_0_14px_rgba(0,0,0,0.85),_2px_2px_8px_rgba(0,0,0,0.65)]">
                Magische Nächte unter freiem Himmel
              </h1>
              <p className="mx-auto max-w-2xl text-balance text-base font-medium leading-relaxed text-white/95 sm:text-lg lg:text-xl [text-shadow:_0_0_10px_rgba(0,0,0,0.65)]">
                Das Ensemble des Sommertheaters lädt zu einem neuen Erlebnis aus Licht, Musik und
                Erzählung ein – nur an einem Wochenende im Schlosspark.
              </p>
              <div className="flex flex-col items-center gap-6">
                <ul className="grid gap-3 text-sm font-medium text-white/80 md:grid-cols-3 md:gap-4">
                  <li className="rounded-full border border-white/20 bg-black/20 px-5 py-2 shadow-md backdrop-blur">
                    Live-Orchester &amp; Chor
                  </li>
                  <li className="rounded-full border border-white/20 bg-black/20 px-5 py-2 shadow-md backdrop-blur">
                    Immersive Lichtinstallationen
                  </li>
                  <li className="rounded-full border border-white/20 bg-black/20 px-5 py-2 shadow-md backdrop-blur">
                    Familienfreundliches Rahmenprogramm
                  </li>
                </ul>
                <div className="flex flex-col items-center justify-center gap-3 md:flex-row md:gap-4">
                  <Button asChild size="lg" className="px-8 py-5 text-base md:text-lg">
                    <Link href="/mystery">Das Geheimnis entdecken</Link>
                  </Button>
                  <Button
                    variant="outline"
                    asChild
                    size="lg"
                    className="border-white/40 bg-white/10 px-8 py-5 text-base text-white hover:border-white/60 hover:bg-white/20 md:text-lg"
                  >
                    <Link href="/chronik">Rückblick 2024</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
