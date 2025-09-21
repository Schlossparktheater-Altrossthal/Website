import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Hero } from "@/components/hero";
import { Badge } from "@/components/ui/badge";
import { Heading, Text } from "@/components/ui/typography";
import { TextLink } from "@/components/ui/text-link";
import { getHeroImages, pickHeroForNow } from "@/lib/hero-images";
import React from "react";

export default function Home() {
  const files = getHeroImages();
  const picked = pickHeroForNow(files) ?? "https://picsum.photos/id/1069/1600/900";
  const heroImages = files.length > 0 ? files.slice(0, 5) : [picked];
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
      <div className="container mx-auto px-4 sm:px-6">
        <div className="space-y-8 py-12 sm:py-16">
          <section className="py-6 text-center sm:py-8">
            <Text tone="muted" className="mt-2 text-sm opacity-80 sm:text-base">
              Ein einziges Wochenende. Ein Sommer. Ein Stück.
            </Text>
            <Heading level="h3" className="mt-4 text-xl text-foreground sm:text-2xl">
              Countdown: bald verfügbar…
            </Heading>
          </section>
          <Card>
            <CardTitle className="p-4">Teaser-Hinweis</CardTitle>
            <CardContent>Folge den Spuren im Nebel…</CardContent>
          </Card>
          <section className="relative overflow-hidden rounded-3xl border border-slate-100/10 bg-slate-900 text-slate-50 shadow-2xl">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.35),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(14,165,233,0.25),_transparent_55%)]"
              aria-hidden="true"
            />
            <div className="relative mx-auto max-w-4xl space-y-8 px-6 py-12 sm:px-10 sm:py-16">
              <div className="space-y-4 text-center sm:space-y-5">
                <Badge
                  variant="ghost"
                  size="sm"
                  className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-200 shadow-sm"
                >
                  FAQ
                </Badge>
                <Heading level="h2" className="text-3xl font-semibold text-white sm:text-4xl">
                  Häufig gestellte Fragen
                </Heading>
                <Text variant="bodyLg" tone="muted" className="text-slate-200 sm:text-lg">
                  Die wichtigsten Antworten rund um das Sommertheater – kompakt und jederzeit nachlesbar.
                </Text>
              </div>
              <div className="space-y-4">
                {faqs.map((faq) => (
                  <details
                    key={faq.question}
                    className="group rounded-2xl border border-white/10 bg-white/10 p-6 text-left shadow-lg backdrop-blur transition duration-300 open:border-white/20 open:bg-white/20"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                      <Text
                        asChild
                        variant="bodyLg"
                        tone="default"
                        weight="semibold"
                        className="text-slate-50 sm:text-xl"
                      >
                        <span>{faq.question}</span>
                      </Text>
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-indigo-100 transition duration-300 group-open:rotate-180">
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
                    <Text className="mt-4 text-base leading-relaxed text-indigo-100">{faq.answer}</Text>
                  </details>
                ))}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-6 py-5 text-sm text-slate-100 backdrop-blur sm:text-base">
                <Text tone="default" className="text-slate-100">
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
