import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import { Cat, Fish, Heart, MoonStar, PawPrint, ShieldCheck, Sun, Users } from "lucide-react";
import Image from "next/image";

import { Card } from "@/components/ui/card";
import { TextLink } from "@/components/ui/text-link";
import { Heading, Text } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Unsere Schulkatze",
  description:
    "Wir erinnern uns an Dieter Dennis von Altroßthal, die graug getigerte Schulkatze des BSZ Altrossthal, und erzählen seine Geschichte.",
  alternates: {
    canonical: "/unsere-schulkatze",
  },
  openGraph: {
    title: "Unsere Schulkatze | Sommertheater Altrossthal",
    description:
      "Porträt und Erinnerungen an Dieter, unsere graug getigerte Schulkatze, die uns über viele Jahre begleitet hat.",
    url: "/unsere-schulkatze",
    type: "website",
  },
};

type Highlight = {
  icon: LucideIcon;
  title: string;
  description: string;
};

type Memory = {
  icon: LucideIcon;
  title: string;
  detail: string;
};

type Supporter = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const highlights: Highlight[] = [
  {
    icon: Cat,
    title: "Porträt",
    description:
      "Dieter Dennis von Altroßthal war unsere graug getigerte Schulkatze – verlässlich, gelassen und immer bereit für eine stille Beobachtung.",
  },
  {
    icon: MoonStar,
    title: "Uralter Bekannter",
    description:
      "Niemand konnte genau sagen, wann er eingezogen ist. Gefühlt streifte er schon seit über fünfzehn, zwanzig Jahren durch den Campus.",
  },
  {
    icon: Heart,
    title: "Teil der Gemeinschaft",
    description:
      "Ob Unterricht oder Premiere: Dieter gehörte einfach dazu und brachte eine Ruhe mit, die uns alle miteinander verband.",
  },
];

const memories: Memory[] = [
  {
    icon: Sun,
    title: "Frühe Streifzüge",
    detail:
      "Geschichten erzählen davon, dass Dieter morgens schon vor dem ersten Klingeln seine Runden drehte und uns mit prüfendem Blick begrüßte.",
  },
  {
    icon: PawPrint,
    title: "Lieblingsorte",
    detail:
      "Fensterbänke, Probebühnen und Parkbänke wurden zu seinen Ruhepolen – überall dort wirkte er wie ein grauer Wächter des Geländes.",
  },
  {
    icon: MoonStar,
    title: "Abende im Park",
    detail:
      "Wenn der Tag endete, blieb er oft noch eine Weile, als wolle er sicherstellen, dass alles seinen Platz hat, bevor er in die Nacht verschwand.",
  },
];

const careCircle: Supporter[] = [
  {
    icon: Users,
    title: "Pflege-AG & Schülerschaft",
    description:
      "In festen Diensten sorgten engagierte Schüler:innen für Futter, frisches Wasser und liebevolle Aufmerksamkeit.",
  },
  {
    icon: ShieldCheck,
    title: "Hausmeisterteam & Tierärztin",
    description:
      "Sie behielten Gesundheit und Sicherheit im Blick, koordinierten Checks und boten Dieter auch in seinen älteren Jahren Halt.",
  },
  {
    icon: Fish,
    title: "Patenschaften & Spenden",
    description:
      "Klassen und Kollegium legten zusammen, damit Futter, Medikamente und letzte Wege gemeinschaftlich getragen wurden.",
  },
];

const lessons: string[] = [
  "Tiere, die unseren Campus begleiten, brauchen feste Bezugspersonen und klare Absprachen – Dieter hat uns das gelehrt.",
  "Gemeinsame Rituale schaffen Vertrauen, besonders wenn ein Vierbeiner über so viele Jahre Teil der Gemeinschaft ist.",
  "In Abschiedsmomenten hilft es, Erinnerungen zu teilen und Orte des Gedenkens zu schaffen.",
  "Wer künftig eine Schulkatze willkommen heißt, sollte an Dieters Bedürfnisse denken: Ruhe, Respekt und Zeit.",
];

export default function SchulkatzePage() {
  return (
    <div className="relative isolate">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background"
          aria-hidden
        />
        <div
          className="absolute left-1/2 top-[-15%] h-[26rem] w-[120vw] -translate-x-1/2 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent blur-3xl opacity-60"
          aria-hidden
        />
        <div
          className="absolute right-[-15%] bottom-[-20%] h-[20rem] w-[90vw] bg-gradient-to-br from-primary/25 via-primary/5 to-transparent blur-3xl opacity-50"
          aria-hidden
        />
      </div>

      <section className="layout-container pb-12 pt-16 sm:pt-24">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <div className="max-w-3xl space-y-6">
            <Text variant="eyebrow" uppercase tone="primary">
              Schulkultur
            </Text>
            <Heading level="h1" className="mt-2">
              Unsere Schulkatze
            </Heading>
            <Text variant="bodyLg" tone="muted" className="mt-4">
              Dieter Dennis von Altroßthal – von allen nur Dieter genannt – war unsere graug getigerte Schulkatze. Über Generationen hinweg
              streifte er durch den Campus und wurde zum vertrauten Gesicht des BSZ Altrossthal.
            </Text>
            <Text tone="muted">
              Niemand wusste genau, seit wann er da war; gefühlt waren es weit über fünfzehn Jahre. Seine stille Präsenz begleitete Unterricht,
              Proben und Festspiele gleichermaßen.
            </Text>
            <Text tone="muted">
              In diesem Jahr mussten wir uns von Dieter verabschieden. Die Erinnerungen an ihn, seine Gelassenheit und die Fürsorge der
              Schulgemeinschaft bleiben und prägen, wie wir auch künftig füreinander da sind.
            </Text>
          </div>
          <figure className="relative mx-auto max-w-sm overflow-hidden rounded-3xl border border-border bg-background shadow-lg">
            <div className="relative aspect-[3/4]">
              <Image
                src="/images/katze/IMG_8370.JPEG"
                alt="Schulkatze Dieter Dennis von Altroßthal, graug getigert, sitzt aufmerksam im Schulhof."
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 320px, (min-width: 768px) 40vw, 90vw"
                priority
              />
            </div>
            <figcaption className="border-t border-border bg-background px-4 py-3 text-sm text-muted-foreground">
              Dieter Dennis von Altroßthal war über viele Jahre Teil unserer Schulgemeinschaft.
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="layout-container pb-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((item) => (
            <Card key={item.title} className="h-full">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/15 text-primary">
                  <item.icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="space-y-2">
                  <Text weight="semibold" className="text-base sm:text-lg">
                    {item.title}
                  </Text>
                  <Text variant="small" tone="muted" className="leading-relaxed">
                    {item.description}
                  </Text>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="layout-container pb-16">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="h-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/15 text-primary">
                <PawPrint className="h-5 w-5" aria-hidden />
              </div>
              <Text weight="semibold" className="text-base sm:text-lg">
                Erinnerungen an Dieter
              </Text>
            </div>
            <div className="space-y-4">
              {memories.map((entry) => (
                <div key={entry.title} className="flex gap-3">
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                    <entry.icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="space-y-1">
                    <Text weight="medium">{entry.title}</Text>
                    <Text variant="small" tone="muted" className="leading-relaxed">
                      {entry.detail}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="h-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/15 text-primary">
                <Heart className="h-5 w-5" aria-hidden />
              </div>
              <Text weight="semibold" className="text-base sm:text-lg">
                Wer sich gekümmert hat
              </Text>
            </div>
            <div className="space-y-3">
              {careCircle.map((entry) => (
                <div key={entry.title} className="flex gap-3">
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                    <entry.icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="space-y-1">
                    <Text weight="medium">{entry.title}</Text>
                    <Text variant="small" tone="muted" className="leading-relaxed">
                      {entry.description}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className="layout-container pb-16">
        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/15 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </div>
            <Text weight="semibold" className="text-base sm:text-lg">
              Was wir aus Dieters Zeit mitnehmen
            </Text>
          </div>
          <div className="space-y-3">
            <Text variant="small" tone="muted">
              Dieter hat uns gezeigt, wie wichtig Achtsamkeit ist. Diese Gedanken begleiten uns auch in Zukunft:
            </Text>
            <ul className="space-y-2">
              {lessons.map((lesson) => (
                <li key={lesson} className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 flex-none rounded-full bg-primary" aria-hidden />
                  <Text variant="small" tone="muted" className="leading-relaxed">
                    {lesson}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </section>

      <section className="layout-container pb-24">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <Heading level="h2" align="center">
            In Erinnerung an Dieter
          </Heading>
          <Text variant="bodyLg" tone="muted" align="center">
            Dieter hat Generationen von Schüler:innen begleitet und unserem Campus ein unverwechselbares Gefühl von Heimat gegeben.
            Seine Geschichte erinnert uns daran, wie wertvoll Fürsorge und Gemeinschaft sind.
          </Text>
          <Text tone="muted" align="center">
            Wer Erinnerungen teilen oder die Arbeit der Pflege-AG weiterführen möchte, erreicht uns unter{' '}
            <TextLink href="mailto:schulkatze@sommertheater-altrossthal.de">schulkatze@sommertheater-altrossthal.de</TextLink>.
          </Text>
        </div>
      </section>
    </div>
  );
}
