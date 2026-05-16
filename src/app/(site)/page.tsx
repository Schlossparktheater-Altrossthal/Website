import { Hero } from "@/components/hero";
import { Badge } from "@/components/ui/badge";
import { Heading, Text } from "@/components/ui/typography";
import { getHeroImages, pickHeroForNow } from "@/lib/hero-images";
import { PremiereCountdownSection } from "./_components/premiere-countdown-section";
import { ProductionFlyerSection } from "@/components/site/production-flyer-section";
import { readProductionFlyerSettings } from "@/lib/production-flyer-settings";
import {
  readPremiereCountdownSettings,
  resolvePremiereCountdownSettings,
} from "@/lib/premiere-countdown-settings";
import React from "react";
import { getPublicPageVisibility } from "@/lib/public-page-visibility";

export default async function PublicHomePage() {
  const publicVisibility = await getPublicPageVisibility();
  const availableHeroImages = getHeroImages();
  const selectedHeroImage = pickHeroForNow(availableHeroImages) ?? "https://picsum.photos/id/1069/1600/900";
  const heroImages = availableHeroImages.length > 0 ? availableHeroImages.slice(0, 5) : [selectedHeroImage];
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
  if (hasDatabase) { try { productionFlyer = await readProductionFlyerSettings(); } catch {} }
  const countdownInitialNow = Date.now();
  const effectiveCountdownTargetIso = resolvedCountdown.effectiveCountdownTarget.toISOString();
  const initialCountdownTargetIso = resolvedCountdown.countdownTarget
    ? resolvedCountdown.countdownTarget.toISOString()
    : null;
  const updatedAtIso = resolvedCountdown.updatedAt ? resolvedCountdown.updatedAt.toISOString() : null;
  const homepageFaqItems = [
    {
      question: "Was ist das Sommertheater im Schlosspark?",
      answer:
        "Unser Sommertheater vereint Musik, Schauspiel und eine Prise Geheimnis vor der einzigartigen Kulisse des Schlossparks. Wir gestalten jedes Jahr ein neues Stück, das unser Publikum aller Altersgruppen begeistert und zum Staunen einlädt.",
    },
    {
      question: "Wann startet der Ticketverkauf?",
      answer:
        "Der Ticketverkauf wird über den Instagram-Kanal der Schule bekanntgegeben. Folge uns dort, um nichts zu verpassen.",
    },
    {
      question: "Wo finden die Aufführungen statt?",
      answer:
        "Die Vorstellungen finden im Schlosspark Altroßthal statt. Adresse: BSZ für Agrarwirtschaft und Ernährung Dresden, Altroßthal 1, 01169 Dresden.",
    },
    {
      question: "Wie lange dauern die Vorstellungen?",
      answer:
        "Die Vorstellungen dauern durchschnittlich 1,5 Stunden und beinhalten eine Pause.",
    },
    {
      question: "Gibt es eine Altersempfehlung?",
      answer: "Das Stück richtet sich an alle Altersgruppen.",
    },
  ];

  return (
    <div>
      <Hero images={heroImages} showMysteryLink={publicVisibility.mystery} showTimelineLink={publicVisibility.timeline} />
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
              <PremiereCountdownSection
                initialCountdownTarget={initialCountdownTargetIso}
                effectiveCountdownTarget={effectiveCountdownTargetIso}
                updatedAt={updatedAtIso}
                hasCustomCountdown={resolvedCountdown.hasCustomCountdown}
                disabled={resolvedCountdown.disabled}
                initialNow={countdownInitialNow}
                termine={(resolvedCountdown.termine as { datum: string; uhrzeit: string; label?: string }[]).map((termin, index) => ({
                  datum: termin.datum ?? "",
                  uhrzeit: termin.uhrzeit ?? "",
                  label: termin.label ?? `Vorstellung ${index + 1}`,
                }))}
                nachSommerText={resolvedCountdown.nachSommerText}
              />
            </div>
          </section>
          <ProductionFlyerSection aktiv={productionFlyer?.aktiv ?? false} titel={productionFlyer?.titel ?? null} beschreibung={productionFlyer?.beschreibung ?? null} hasBild={Boolean(productionFlyer?.bildData && productionFlyer?.bildMimeType)} />
          <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/90 text-card-foreground shadow-2xl">
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
                <Heading level="h2" align="center" className="text-[clamp(2rem,5.5vw,3.4rem)] font-extrabold">
                  Häufig gestellte Fragen
                </Heading>
              </div>
              <div className="space-y-4">
                {homepageFaqItems.map((faq) => (
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
