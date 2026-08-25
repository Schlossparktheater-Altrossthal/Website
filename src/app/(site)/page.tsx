export const revalidate = 60;

import { Hero } from "@/components/hero";
import { Badge } from "@/components/ui/badge";
import { Heading, Text } from "@/components/ui/typography";
import { getHeroImages, pickHeroForNow } from "@/lib/hero-images";
import { ShowCountdownSection } from "./_components/premiere-countdown-section";
import { HomepageLinkCards } from "./_components/homepage-link-cards";
import { ShowFlyerSection } from "@/components/site/production-flyer-section";
import { readProductionFlyerSettings } from "@/lib/production-flyer-settings";
import {
  readPremiereCountdownSettings,
  resolvePremiereCountdownSettings,
} from "@/lib/premiere-countdown-settings";
import React from "react";
import { readFaqContent } from "@/lib/website-content";
import { getPublicPageVisibility } from "@/lib/public-page-visibility";

export default async function PublicHomePage() {
  const publicVisibility = await getPublicPageVisibility();
  const availableHeroImages = getHeroImages();
  const selectedHeroImage =
    pickHeroForNow(availableHeroImages) ?? "https://picsum.photos/id/1069/1600/900";
  const heroImages =
    availableHeroImages.length > 0 ? availableHeroImages.slice(0, 5) : [selectedHeroImage];
  let countdownRecord = null;
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  if (hasDatabase) {
    try {
      countdownRecord = await readPremiereCountdownSettings();
    } catch (error) {
      console.error("Failed to load premiere countdown settings", error);
    }
  }
  const resolvedCountdown = resolvePremiereCountdownSettings(countdownRecord);
  let productionFlyer = null;
  if (hasDatabase) {
    try {
      productionFlyer = await readProductionFlyerSettings();
    } catch {}
  }
  const faqContent = await readFaqContent();
  const effectiveCountdownTargetIso = resolvedCountdown.effectiveCountdownTarget.toISOString();
  const initialCountdownTargetIso = resolvedCountdown.countdownTarget
    ? resolvedCountdown.countdownTarget.toISOString()
    : null;
  const updatedAtIso = resolvedCountdown.updatedAt
    ? resolvedCountdown.updatedAt.toISOString()
    : null;

  return (
    <div>
      <Hero
        images={heroImages}
        showMysteryLink={publicVisibility.mystery}
        showTimelineLink={publicVisibility.timeline}
      />
      <div className="layout-container">
        <div className="space-y-12 py-16">
          <section className="flex flex-col items-center gap-6 text-center">
            <Text
              variant="eyebrow"
              uppercase
              tone="primary"
              className="tracking-[0.18em] sm:tracking-[0.22em]"
            >
              Sommertheater Altrossthal
            </Text>
            <div className="w-full max-w-3xl">
              <ShowCountdownSection
                initialCountdownTarget={initialCountdownTargetIso}
                effectiveCountdownTarget={effectiveCountdownTargetIso}
                updatedAt={updatedAtIso}
                hasCustomCountdown={resolvedCountdown.hasCustomCountdown}
                disabled={resolvedCountdown.disabled}
                scheduledDates={resolvedCountdown.termine.map((termin, index) => ({
                  date: termin.datum ?? "",
                  time: termin.uhrzeit ?? "",
                  label: termin.label ?? `Vorstellung ${index + 1}`,
                }))}
                postShowText={resolvedCountdown.nachSommerText}
              />
            </div>
          </section>
          <ShowFlyerSection
            active={productionFlyer?.aktiv ?? false}
            title={productionFlyer?.titel ?? null}
            description={productionFlyer?.beschreibung ?? null}
            hasImage={Boolean(productionFlyer?.bildData && productionFlyer?.bildMimeType)}
          />
          <HomepageLinkCards />
          <section className="relative mt-24 overflow-hidden rounded-3xl border border-border/60 bg-card/90 text-card-foreground shadow-2xl">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,var(--primary)_35%,transparent),_transparent_60%),radial-gradient(circle_at_bottom,_color-mix(in_oklab,var(--info)_25%,transparent),_transparent_55%)]"
              aria-hidden="true"
            />
            <div className="relative mx-auto max-w-4xl space-y-8 px-responsive-lg py-14">
              <div className="space-y-4 text-center">
                <Badge
                  variant="outline"
                  size="sm"
                  className="inline-flex rounded-full border-primary/40 bg-primary/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary shadow-sm"
                >
                  FAQ
                </Badge>
                <Heading
                  level="h2"
                  align="center"
                  className="text-[clamp(2rem,5.5vw,3.4rem)] font-extrabold"
                >
                  Häufig gestellte Fragen
                </Heading>
              </div>
              <div className="space-y-4">
                {faqContent.items.map((faq) => (
                  <details
                    key={faq.question}
                    className="group rounded-2xl border border-border/60 bg-background/60 p-6 text-left shadow-lg backdrop-blur transition duration-300 open:border-primary/40 open:bg-background/80"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                      <Text asChild variant="bodyLg" weight="semibold">
                        <span>{faq.question}</span>
                      </Text>
                      <svg
                        className="h-4 w-4 text-orange-500 transition duration-300 group-open:rotate-180"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </summary>
                    <Text tone="muted" className="mt-4 leading-relaxed">
                      {faq.answer}
                    </Text>
                  </details>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
      {/* JSON-LD for basic organization/site */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Sommertheater im Schlosspark",
            url: (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, ""),
          }),
        }}
      />
    </div>
  );
}
