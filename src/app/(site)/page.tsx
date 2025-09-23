import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Hero } from "@/components/hero";
import { Badge } from "@/components/ui/badge";
import { Heading, Text } from "@/components/ui/typography";
import { TextLink } from "@/components/ui/text-link";
import { getHeroImages, pickHeroForNow } from "@/lib/hero-images";
import { HomepageCountdown } from "./_components/homepage-countdown";
import {
  DEFAULT_HOMEPAGE_COUNTDOWN_ISO,
  readHomepageCountdown,
  resolveHomepageCountdown,
} from "@/lib/homepage-countdown";
import React from "react";

export default async function Home() {
  const files = getHeroImages();
  const picked = pickHeroForNow(files) ?? "https://picsum.photos/id/1069/1600/900";
  const heroImages = files.length > 0 ? files.slice(0, 5) : [picked];
  let countdownRecord = null;
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  if (hasDatabase) {
    try {
      countdownRecord = await readHomepageCountdown();
    } catch (error) {
      console.error("Failed to load homepage countdown settings", error);
    }
  }
  const resolvedCountdown = resolveHomepageCountdown(countdownRecord);
  const effectiveCountdownTargetIso = resolvedCountdown.effectiveCountdownTarget.toISOString();
  const initialCountdownTargetIso = resolvedCountdown.countdownTarget
    ? resolvedCountdown.countdownTarget.toISOString()
    : null;
  const updatedAtIso = resolvedCountdown.updatedAt ? resolvedCountdown.updatedAt.toISOString() : null;
  const serverNowIso = new Date().toISOString();
  const faqs = [
    {
      question: "Was ist das Sommertheater im Schlosspark?",
      answer:
        "Unser Sommertheater vereint Musik, Schauspiel und eine Prise Geheimnis vor der einzigartigen Kulisse des Schlossparks. Wir gestalten jedes Jahr ein neues Stück, das Besucher*innen aller Altersgruppen begeistert und zum Staunen einlädt.",
    },
    {
      question: "Wann startet der Ticketverkauf?",
      answer:
        "Der genaue Starttermin wird in Kürze bekannt gegeben. Trag dich am besten in unseren Newsletter ein oder folge uns auf Social Media, damit du den Verkaufsbeginn und mögliche Frühbucher*innen-Aktionen nicht verpasst.",
    },
    {
      question: "Benötige ich Vorkenntnisse, um das Stück zu genießen?",
      answer:
        "Nein – unsere Inszenierungen sind so konzipiert, dass alle Gäste ohne Vorkenntnisse direkt eintauchen können. Dank moderner Regie und einer leicht zugänglichen Handlung findet jede*r schnell in die Geschichte hinein.",
    },
    {
      question: "Gibt es Ermäßigungen für Gruppen oder Familien?",
      answer:
        "Ja, wir planen besondere Konditionen für Gruppen ab zehn Personen sowie familienfreundliche Pakete. Alle Details geben wir rechtzeitig vor dem Vorverkaufsstart bekannt.",
    },
    {
      question: "Wie kann ich mich kreativ einbringen oder ehrenamtlich helfen?",
      answer:
        "Wir freuen uns immer über helfende Hände und kreative Köpfe – ob beim Bühnenbau, in der Öffentlichkeitsarbeit oder als Gastspielpartner*in. Schreib uns einfach eine Nachricht über das Kontaktformular, und wir melden uns bei dir.",
    },
  ];

  return (
    <div>
      <Hero images={heroImages} />
      <div className="layout-container">
        <div className="space-y-12 py-16">
          <section className="flex flex-col items-center gap-6 text-center">
            <Text variant="eyebrow" uppercase tone="primary">
              Sommertheater Altrossthal
            </Text>
            <HomepageCountdown
              initialCountdownTarget={initialCountdownTargetIso}
              effectiveCountdownTarget={effectiveCountdownTargetIso}
              defaultCountdownTarget={DEFAULT_HOMEPAGE_COUNTDOWN_ISO}
              updatedAt={updatedAtIso}
              hasCustomCountdown={resolvedCountdown.hasCustomCountdown}
              serverNow={serverNowIso}
            />
            <Text variant="bodyLg" align="center" tone="muted">
              Ein einziges Wochenende. Ein Sommer. Ein Stück.
            </Text>
          </section>
          <Card>
            <CardTitle className="px-6 pt-6 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Teaser-Hinweis
            </CardTitle>
            <CardContent className="pb-6 text-muted-foreground">Folge den Spuren im Nebel…</CardContent>
          </Card>
          <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/90 text-card-foreground shadow-2xl">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,var(--primary)_35%,transparent),_transparent_60%),radial-gradient(circle_at_bottom,_color-mix(in_oklab,var(--info)_25%,transparent),_transparent_55%)]"
              aria-hidden="true"
            />
            <div className="relative mx-auto max-w-4xl space-y-8 px-8 py-14 sm:px-12">
              <div className="space-y-4 text-center">
                <Badge
                  variant="outline"
                  size="sm"
                  className="inline-flex rounded-full border-primary/40 bg-primary/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary shadow-sm"
                >
                  FAQ
                </Badge>
                <Heading level="h2" align="center">
                  Häufig gestellte Fragen
                </Heading>
                <Text variant="bodyLg" align="center" tone="muted">
                  Die wichtigsten Antworten rund um das Sommertheater – kompakt und jederzeit nachlesbar.
                </Text>
              </div>
              <div className="space-y-4">
                {faqs.map((faq) => (
                  <details
                    key={faq.question}
                    className="group rounded-2xl border border-border/60 bg-background/60 p-6 text-left shadow-lg backdrop-blur transition duration-300 open:border-primary/40 open:bg-background/80"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                      <Text asChild variant="bodyLg" weight="semibold">
                        <span>{faq.question}</span>
                      </Text>
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border/50 bg-background/70 text-primary transition duration-300 group-open:rotate-180">
                        <svg
                          className="h-4 w-4"
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
                      </span>
                    </summary>
                    <Text tone="muted" className="mt-4 leading-relaxed">
                      {faq.answer}
                    </Text>
                  </details>
                ))}
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 px-6 py-5 text-sm text-muted-foreground backdrop-blur">
                <Text>
                  Noch Fragen offen? Schreib uns jederzeit an
                  <TextLink className="ml-2" href="mailto:hallo@sommertheater.de" variant="accent" weight="semibold">
                    hallo@sommertheater.de
                  </TextLink>
                  – wir freuen uns auf deine Nachricht!
                </Text>
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
