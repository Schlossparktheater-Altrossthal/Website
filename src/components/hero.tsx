"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Heading, Text } from "@/components/ui/typography";
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
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none" />
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
            <div className="flex flex-col items-center gap-8 md:gap-10">
              <Heading level="display" weight="bold" className="font-serif text-balance text-white">
                <span className="relative inline-flex flex-col items-center">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-14 left-1/2 hidden h-32 w-64 -translate-x-1/2 -skew-x-6 rounded-full border border-white/10 bg-white/10 opacity-60 blur-3xl sm:block -z-10"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -left-14 top-1/2 hidden h-24 w-24 -translate-y-1/2 rounded-full border border-white/20 bg-[color-mix(in_oklab,var(--primary)_55%,transparent)] opacity-70 blur-2xl md:block -z-10"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-16 top-1/2 hidden h-28 w-28 -translate-y-1/2 rounded-full border border-white/10 bg-[color-mix(in_oklab,var(--primary)_35%,transparent)] opacity-75 blur-[90px] lg:block -z-10"
                  />
                  <span className="relative inline-flex flex-col items-center gap-5 rounded-[3rem] border border-white/40 bg-white/10 px-8 py-7 text-center shadow-[0_30px_90px_rgba(15,23,42,0.65)] backdrop-blur-xl sm:px-14 sm:py-10">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-[3rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.25),rgba(255,255,255,0.05))] opacity-70 [mask-image:radial-gradient(circle_at_center,black,transparent_75%)] -z-10"
                    />
                    <span className="relative text-[clamp(2.5rem,6vw,4.9rem)] uppercase tracking-[0.18em] leading-[0.9] text-white drop-shadow-[0_18px_45px_rgba(0,0,0,0.55)]">
                      Das Geheimnis
                    </span>
                    <span className="relative text-[clamp(2.2rem,5vw,4.3rem)] uppercase tracking-[0.32em] leading-[0.9] text-white/90 drop-shadow-[0_18px_45px_rgba(0,0,0,0.55)]">
                      im Schlosspark
                    </span>
                  </span>
                </span>
              </Heading>
              <Text
                variant="lead"
                weight="medium"
                className="mx-auto max-w-3xl text-balance text-white/95 [text-shadow:_0_0_10px_rgba(0,0,0,0.55)]"
              >
                Ein Sommer. Ein Wochenende. Ein einziges Stück – verborgen zwischen Licht und Laub.
              </Text>
              <div className="flex flex-col items-center justify-center gap-4 md:flex-row md:gap-5">
                <Button
                  asChild
                  size="xl"
                  className="px-8 py-5 text-base font-semibold tracking-wide md:px-10 md:text-lg"
                >
                  <Link href="/mystery">Das Geheimnis entdecken</Link>
                </Button>
                <Button
                  variant="outline"
                  asChild
                  size="xl"
                  className="border-white/50 bg-white/10 px-8 py-5 text-base font-semibold text-white shadow-lg backdrop-blur md:px-10 md:text-lg"
                >
                  <Link href="/chronik">Chronik</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
