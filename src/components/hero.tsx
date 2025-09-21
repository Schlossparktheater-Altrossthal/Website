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
              <Heading
                level="display"
                weight="bold"
                className="font-serif text-balance leading-[0.92] text-white drop-shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
              >
                <span className="block">Das Geheimnis</span>
                <span className="block">im Schlosspark</span>
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
