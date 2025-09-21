"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Heading, Text } from "@/components/ui/typography";
import { HeroRotator } from "@/components/hero-rotator";
import { BookOpen, Sparkles } from "lucide-react";

export function Hero({ images }: { images: string[] }) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const rotateImages = images.length > 0 ? images.slice(0, 5) : ["https://picsum.photos/id/1069/1600/900"];

  return (
    <section className="hero-section relative h-screen min-h-[100dvh] w-full overflow-hidden sm:min-h-[90vh] lg:min-h-[100vh]">
      <div
        className="absolute inset-0 z-0 h-full w-full overflow-hidden"
        style={{
          transform: `translateY(${scrollY * 0.4}px) scale(${1 + scrollY * 0.0006})`,
          filter: `blur(${Math.min(scrollY * 0.018, 6)}px)`,
        }}
      >
        <HeroRotator images={rotateImages} />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.22),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(192,132,252,0.28),transparent_55%),radial-gradient(circle_at_50%_80%,rgba(252,211,77,0.2),transparent_52%)] mix-blend-screen opacity-75"
        />
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 bg-[linear-gradient(to_bottom,rgba(6,11,25,0.92),rgba(6,11,25,0.4)_42%,rgba(7,10,19,0.95))]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_bottom,rgba(17,24,39,0.9),transparent_55%)] mix-blend-multiply"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_30%_70%,rgba(15,118,110,0.18),transparent_65%),radial-gradient(circle_at_72%_20%,rgba(251,191,36,0.22),transparent_60%)] opacity-80 mix-blend-screen"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 opacity-[0.38] mix-blend-soft-light [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.12),rgba(255,255,255,0)_68%)]"
      />

      <div className="hero-content relative z-20 flex h-full items-center justify-center px-6 pt-20 pb-14 sm:px-8 md:pb-24">
        <div className="layout-container">
          <div
            className="mx-auto max-w-5xl text-center"
            style={{
              transform: `translateY(${scrollY * -0.25}px)`,
            }}
          >
            <div className="flex flex-col items-center gap-10 md:gap-12">
              <Heading level="display" weight="bold" className="font-serif text-balance text-white">
                <span className="relative inline-flex flex-col items-center gap-9">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-28 hidden h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(253,224,71,0.35),transparent_60%)] blur-[110px] sm:block"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-24 hidden h-72 w-[28rem] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.28),transparent_65%)] blur-[120px] md:block"
                  />
                  <span className="relative isolate inline-flex flex-col items-center gap-6 overflow-hidden rounded-[3.6rem] border border-white/20 bg-white/10 px-10 py-10 text-center shadow-[0_40px_130px_rgba(6,12,30,0.6)] backdrop-blur-3xl sm:px-16 sm:py-14">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-[inherit] border border-white/60 opacity-35 [mask-image:linear-gradient(to_bottom,rgba(255,255,255,0.95),transparent_80%)]"
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -inset-[4.5rem] -z-10 bg-[conic-gradient(from_110deg_at_50%_50%,rgba(59,130,246,0.28),rgba(236,72,153,0.22),rgba(16,185,129,0.25),rgba(59,130,246,0.28))] opacity-60 blur-3xl"
                    />
                    <span className="relative text-[clamp(2.8rem,6.5vw,5.4rem)] uppercase tracking-[0.14em] leading-[0.92]">
                      <span className="bg-gradient-to-br from-white via-white to-white/75 bg-clip-text text-transparent drop-shadow-[0_26px_55px_rgba(5,8,22,0.7)]">
                        Das Geheimnis
                      </span>
                    </span>
                    <span className="relative text-[clamp(2.4rem,5.6vw,4.6rem)] uppercase tracking-[0.32em] leading-[0.9] text-white/90">
                      <span className="bg-gradient-to-r from-white/80 via-white to-white/70 bg-clip-text text-transparent drop-shadow-[0_20px_48px_rgba(5,8,22,0.62)]">
                        im Schlosspark
                      </span>
                    </span>
                  </span>
                  <span aria-hidden="true" className="mt-1 flex w-36 items-center justify-center gap-3">
                    <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                    <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                  </span>
                </span>
              </Heading>
              <Text
                variant="lead"
                weight="medium"
                className="mx-auto max-w-3xl text-balance text-white/85 [text-shadow:_0_20px_45px_rgba(5,8,22,0.65)]"
              >
                Ein Sommer. Ein Wochenende. Ein einziges Stück – verborgen zwischen Licht und Laub.
              </Text>
              <div className="flex flex-col items-center justify-center gap-4 md:flex-row md:gap-5">
                <Button asChild size="xl" className="px-8 py-5 text-base font-semibold tracking-wide md:px-10 md:text-lg">
                  <Link href="/mystery" title="Geheimnis entdecken">
                    <Sparkles aria-hidden className="h-5 w-5" />
                    <span>Das Geheimnis entdecken</span>
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  asChild
                  size="xl"
                  className="border-white/50 bg-white/10 px-8 py-5 text-base font-semibold text-white shadow-lg backdrop-blur md:px-10 md:text-lg"
                >
                  <Link href="/chronik" title="Chronik öffnen">
                    <BookOpen aria-hidden className="h-5 w-5" />
                    <span>Chronik</span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
