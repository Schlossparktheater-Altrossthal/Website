import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Hero } from "@/components/hero";
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
          <section className="text-center py-6 sm:py-8">
            <div className="mt-2 opacity-80">Ein einziges Wochenende. Ein Sommer. Ein Stück.</div>
            <div className="mt-4 text-xl">Countdown: bald verfügbar…</div>
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
                <p className="inline-flex rounded-full bg-white/10 px-4 py-1 text-sm font-medium uppercase tracking-[0.18em] text-indigo-200 shadow-sm">
                  FAQ
                </p>
                <h2 className="text-3xl font-semibold sm:text-4xl">Häufig gestellte Fragen</h2>
                <p className="text-base text-slate-200 sm:text-lg">
                  Die wichtigsten Antworten rund um das Sommertheater – kompakt und jederzeit nachlesbar.
                </p>
              </div>
              <div className="space-y-4">
                {faqs.map((faq) => (
                  <details
                    key={faq.question}
                    className="group rounded-2xl border border-white/10 bg-white/10 p-6 text-left shadow-lg backdrop-blur transition duration-300 open:border-white/20 open:bg-white/20"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-slate-50 sm:text-xl">
                      <span>{faq.question}</span>
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
                    <p className="mt-4 text-base leading-relaxed text-indigo-100">{faq.answer}</p>
                  </details>
                ))}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-6 py-5 text-sm text-slate-100 backdrop-blur sm:text-base">
                Noch Fragen offen? Schreib uns jederzeit an
                <a className="ml-2 font-semibold text-sky-200 underline underline-offset-4 hover:text-sky-100" href="mailto:hallo@sommertheater.de">
                  hallo@sommertheater.de
                </a>
                – wir freuen uns auf deine Nachricht!
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
