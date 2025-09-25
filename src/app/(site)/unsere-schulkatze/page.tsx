import { readdirSync } from "node:fs";
import path from "node:path";

import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import { Cat, Heart, MoonStar, PawPrint, ShieldCheck, Sun, Users } from "lucide-react";

import { Card } from "@/components/ui/card";
import { TextLink } from "@/components/ui/text-link";
import { Heading, Text } from "@/components/ui/typography";

import { DennisDieterEncountersSection } from "./encounters-section";
import { SchulkatzeImageRotator } from "./image-rotator";

const SUPPORTED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

function resolveSchulkatzeImages(): string[] {
  const directory = path.join(process.cwd(), "public", "images", "katze");

  try {
    const files = readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => SUPPORTED_IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b));

    if (files.length > 0) {
      return Array.from(new Set(files)).map((name) => `/images/katze/${name}`);
    }
  } catch {
    // Wenn das Verzeichnis nicht gelesen werden kann, nutzen wir den Fallback weiter unten.
  }

  return ["/images/katze/IMG_8370.JPEG"];
}

const schulkatzeImages = resolveSchulkatzeImages();

export const metadata: Metadata = {
  title: "Unsere Schulkatze",
  description:
    "Wir stellen Dennis Dieter von Altroßthal, die neugierige Schulkatze des BSZ Altroßthal, vor und sammeln seine Geschichten.",
  alternates: {
    canonical: "/unsere-schulkatze",
  },
  openGraph: {
    title: "Unsere Schulkatze | Sommertheater Altroßthal",
    description:
      "Porträt und Begegnungen mit Dennis Dieter, unserer grau getigerten Schulkatze, der seit 2024 Teil des BSZ Altroßthal ist.",
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
      "Dennis Dieter von Altroßthal ist unsere grau getigerte Schulkatze – aufmerksam, verspielt und immer auf der Suche nach einem sonnigen Platz.",
  },
  {
    icon: MoonStar,
    title: "Neu auf dem Campus",
    description:
      "Seit dem Frühjahr 2024 erkundet er jeden Winkel des Schulgeländes und begrüßt Frühaufsteher auf dem Weg zur ersten Stunde.",
  },
  {
    icon: Heart,
    title: "Teil der Gemeinschaft",
    description:
      "Ob Unterricht, Probentage oder Premiere: Dennis Dieter sucht die Nähe der Menschen und schenkt uns Momente der Ruhe.",
  },
];

const memories: Memory[] = [
  {
    icon: Sun,
    title: "Uralter Bekannter",
    detail:
      "Niemand konnte genau sagen, wann er eingezogen ist. Gefühlt streifte er schon seit über fünfzehn Jahren über das Schulgelände.",
  },
  {
    icon: PawPrint,
    title: "Lieblingsorte",
    detail:
      "Die Bänke und Tische im Grünen Klassenzimmer, die Probebühne und sonnige Plätzchen wurden zu seinen Ruhepolen – überall dort wirkte er wie ein grauer Wächter des Geländes.",
  },
  {
    icon: MoonStar,
    title: "Abende im Park",
    detail:
      "Nach Proben oder Aufführungen begleitet er uns noch bis zur Straßenbahnhaltestelle und verabschiedet die letzten Gäste mit einem sanften Miauen.",
  },
];

const careCircle: Supporter[] = [
  {
    icon: Users,
    title: "Schüler:innen & Kollegium",
    description:
      "Ohne feste Dienste brachten Schüler:innen und Lehrkräfte Futter, frisches Wasser und liebevolle Aufmerksamkeit direkt aus dem Alltag mit.",
  },
  {
    icon: ShieldCheck,
    title: "Hausmeisterteam & Tierarzt",
    description:
      "Sie behielten Dennis Dieters Gesundheit im Blick, koordinierten Checks und sorgten für sichere Rückzugsorte auf dem Campus.",
  },
];

const lessons: string[] = [
  "Dennis Dieter zeigte uns, wie sehr er Streicheleinheiten schätzte – und wie achtsam wir mit seinen Signalen umgehen mussten.",
  "Gleichzeitig liebte er seine Freiheit: offene Türen, weite Wege und das Recht, jederzeit eigene Runden zu drehen.",
  "Ruhige Ecken und respektvolle Distanz gaben ihm Kraft, nach neugierigen Streifzügen wieder aufzutanken.",
  "Wer künftig eine Schulkatze willkommen heißt, sollte Nähe und Freiraum im Gleichgewicht halten.",
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
              Dennis Dieter von Altroßthal – von allen nur Dennis Dieter genannt – ist unsere neue grau getigerte Schulkatze. Seit dem Frühjahr
              2024 streift er über das Schulgelände und begrüßt Besucher mit neugierigen Blicken.
            </Text>
            <Text tone="muted">
              Mit seiner offenen Art begleitet er Unterricht, Proben und Premieren gleichermaßen. Mal liegt er mitten im
              Kostümfundus, mal sitzt er aufmerksam im Zuschauerraum und beobachtet jede Szene.
            </Text>
            <Text tone="muted">
              Schüler:innen und Lehrkräfte achten gemeinsam darauf, dass Dennis Dieter seinen eigenen Rhythmus behalten kann. Er zeigt uns,
              wie Fürsorge und Rücksicht eine Gemeinschaft stärken – auch ohne feste Dienste oder eine eigene AG.
            </Text>
          </div>
          <figure className="relative mx-auto max-w-sm overflow-hidden rounded-3xl border border-border bg-background shadow-lg">
            <SchulkatzeImageRotator
              images={schulkatzeImages}
              alt="Schulkatze Dennis Dieter von Altroßthal, grau getigert, sitzt aufmerksam im Schulhof."
            />
            <figcaption className="border-t border-border bg-background px-4 py-3 text-sm text-muted-foreground">
              Dennis Dieter von Altroßthal ist seit 2024 Teil unserer Schulgemeinschaft.
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
                Erinnerungen an Dennis Dieter
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
                Wer sich kümmert
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
              Was wir aus Dennis Dieters Zeit mitnehmen
            </Text>
          </div>
          <div className="space-y-3">
            <Text variant="small" tone="muted">
              Dennis Dieter hat uns gelehrt, Nähe und Freiraum in Balance zu halten. Diese Gedanken begleiten uns:
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

      <DennisDieterEncountersSection />

      <section className="layout-container pb-24">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <Heading level="h2" align="center">
            Gemeinsam für Dennis Dieter
          </Heading>
          <Text variant="bodyLg" tone="muted" align="center">
            Dennis Dieter bringt frischen Wind in unsere Schulgemeinschaft und erinnert uns daran, wie schön geteilte Verantwortung sein
            kann. Jede Begegnung mit ihm erzählt eine neue Geschichte.
          </Text>
          <Text tone="muted" align="center">
            Wer Tipps zur Eingewöhnung hat oder schöne Erinnerungen teilen möchte, erreicht uns unter{' '}
            <TextLink href="mailto:schulkatze@sommertheater-altrossthal.de">schulkatze@sommertheater-altrossthal.de</TextLink>.
          </Text>
        </div>
      </section>
    </div>
  );
}
