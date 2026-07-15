"use client";

import { BookOpenIcon, SparklesIcon } from "@/components/ui/action-icons";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Heading, Text } from "@/components/ui/typography";
import { HeroRotator } from "@/components/hero-rotator";

export function Hero({ images, showMysteryLink = true, showTimelineLink = true }: { images: string[]; showMysteryLink?: boolean; showTimelineLink?: boolean }) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const rotateImages = images.length > 0 ? images.slice(0, 5) : ["https://picsum.photos/id/1069/1600/900"];

  return (
    <section
      className="hero-section relative min-h-[100vh] supports-[min-height:100svh]:min-h-[100svh] supports-[min-height:100dvh]:min-h-[100dvh] w-full overflow-hidden sm:min-h-[90vh] sm:supports-[min-height:100svh]:min-h-[90svh] sm:supports-[min-height:100dvh]:min-h-[90dvh] lg:min-h-[100vh] lg:supports-[min-height:100svh]:min-h-[100svh] lg:supports-[min-height:100dvh]:min-h-[100dvh]"
    >
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

      <div className="hero-content relative z-20 flex h-full items-center justify-center">
        <div className="layout-container flex h-full items-center justify-center pt-20 pb-14 md:pb-24">
          <div
            className="mx-auto max-w-5xl text-center"
            style={{
              transform: `translateY(${scrollY * -0.25}px)`,
            }}
          >
            <div className="flex flex-col items-center gap-10 md:gap-12">
              <Heading level="display" weight="bold" className="font-serif text-balance text-primary-foreground">
                <span className="relative inline-flex flex-col items-center gap-9">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-28 hidden h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(253,224,71,0.35),transparent_60%)] blur-[110px] sm:block"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-24 hidden h-72 w-[28rem] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.28),transparent_65%)] blur-[120px] md:block"
                  />
                  <span className="relative isolate inline-flex flex-col items-center gap-5 overflow-hidden rounded-[3rem] border border-white/25 bg-card/8 px-8 py-8 text-center backdrop-blur-2xl sm:px-14 sm:py-12">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-[inherit] border border-white/50 opacity-35 [mask-image:linear-gradient(to_bottom,rgba(255,255,255,0.85),transparent_78%)]"
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -inset-[4rem] -z-10 bg-[conic-gradient(from_110deg_at_50%_50%,rgba(59,130,246,0.22),rgba(236,72,153,0.18),rgba(16,185,129,0.2),rgba(59,130,246,0.22))] opacity-60 blur-[110px]"
                    />
                    <span className="relative text-[clamp(1.8rem,8vw,5rem)] uppercase tracking-[0.12em] leading-[0.94]">
                      <span className="bg-gradient-to-br from-white via-white/95 to-white/70 bg-clip-text text-transparent drop-">
                        Das Geheimnis
                      </span>
                    </span>
                    <span className="relative text-[clamp(1.5rem,7vw,4.5rem)] uppercase tracking-[0.26em] leading-[0.92] text-primary-foreground/85">
                      <span className="bg-gradient-to-r from-white/80 via-white to-white/65 bg-clip-text text-transparent drop-">
                        im Schlosspark
                      </span>
                    </span>
                  </span>
                  <span aria-hidden="true" className="mt-1 flex w-36 items-center justify-center gap-3">
                    <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                    <span className="h-1.5 w-1.5 rounded-full bg-card/80" />
                    <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                  </span>
                </span>
              </Heading>
              <Text
                variant="lead"
                weight="medium"
                className="mx-auto max-w-3xl text-balance text-primary-foreground/85 [text-shadow:_0_20px_45px_rgba(5,8,22,0.65)]"
              >
                Ein Sommer. Ein Wochenende. Ein einziges Stück – verborgen zwischen Licht und Laub.
              </Text>
              <div className="flex flex-col items-center justify-center gap-4 md:flex-row md:gap-5">
                {showMysteryLink ? <Button
                  asChild
                  size="xl"
                  className="w-[clamp(200px,60vw,340px)] rounded-[clamp(0.75rem,2vw,1rem)] px-[clamp(1rem,3vw,2rem)] py-[clamp(0.6rem,2vw,1rem)] text-[clamp(0.85rem,2vw,1rem)] font-semibold tracking-wide"
                >
                  <Link href="/mystery" title="Geheimnis entdecken">
                    <SparklesIcon aria-hidden className="h-5 w-5" />
                    <span>Das Geheimnis entdecken</span>
                  </Link>
                </Button> : null}
                {showTimelineLink ? <Button
                  variant="outline"
                  asChild
                  size="xl"
                  className="w-[clamp(200px,60vw,340px)] rounded-[clamp(0.75rem,2vw,1rem)] border-white/50 bg-card/10 px-[clamp(1rem,3vw,2rem)] py-[clamp(0.6rem,2vw,1rem)] text-[clamp(0.85rem,2vw,1rem)] font-semibold text-primary-foreground shadow-lg backdrop-blur"
                >
                  <Link href="/chronik" title="Chronik öffnen">
                    <BookOpenIcon aria-hidden className="h-5 w-5" />
                    <span>Chronik</span>
                  </Link>
                </Button> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
