import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import { Cat, Fish, Heart, MoonStar, PawPrint, ShieldCheck, Sun, Users } from "lucide-react";

import { Card } from "@/components/ui/card";
import { TextLink } from "@/components/ui/text-link";
import { Heading, Text } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Unsere Schulkatze",
  description:
    "Lerne Minna, die Schulkatze des BSZ Altrossthal, kennen und erfahre, wie unser Ensemble ihren Alltag gestaltet.",
  alternates: {
    canonical: "/unsere-schulkatze",
  },
  openGraph: {
    title: "Unsere Schulkatze | Sommertheater Altrossthal",
    description:
      "Einblicke in Minnas Alltag auf dem Campus und wie wir gemeinsam für sie sorgen.",
    url: "/unsere-schulkatze",
    type: "website",
  },
};

type Highlight = {
  icon: LucideIcon;
  title: string;
  description: string;
};

type RoutineEntry = {
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
      "Unsere Schulkatze Minna lebt seit 2018 im Schlosspark. Die rotgetigerte Samtpfote kennt jede Probe, jeden Lichtwechsel und findet zielsicher die sonnigsten Plätze.",
  },
  {
    icon: MoonStar,
    title: "Lieblingsplätze",
    description:
      "Morgens streift sie durch den Werkstatthof, nachmittags ruht sie zwischen Requisiten und Kulissengängen. Wenn es ruhig wird, sucht sie die Lichterketten über der Tribüne.",
  },
  {
    icon: Heart,
    title: "Stimmungsmacherin",
    description:
      "Minna begrüßt Besucher:innen, begleitet Pausen und sorgt mit ihrer Gelassenheit dafür, dass Lampenfieber sich in Vorfreude verwandelt.",
  },
];

const routine: RoutineEntry[] = [
  {
    icon: Sun,
    title: "Morgendliche Runde",
    detail:
      "Kurz nach dem ersten Klingeln begrüßt Minna das Hausteam, kontrolliert ihre Futterstelle und lässt sich von Frühaufsteher:innen behutsam kraulen.",
  },
  {
    icon: PawPrint,
    title: "Werkstattbesuche",
    detail:
      "Während der Werkstattzeiten schaut sie beim Kulissenbau und in der Floristik vorbei, beobachtet vom Regal aus das Gewusel und erinnert uns an Pausen.",
  },
  {
    icon: MoonStar,
    title: "Abendliches Zurückziehen",
    detail:
      "Bei Dämmerung begleitet sie die Pflege-AG in ihr warmes Quartier. Dort hat sie Ruhe, bis der Campus am nächsten Morgen wieder erwacht.",
  },
];

const supportNetwork: Supporter[] = [
  {
    icon: Users,
    title: "Pflege-AG",
    description:
      "Schüler:innen übernehmen im wöchentlichen Wechsel Fütterung, Fellpflege und ein Stimmungsprotokoll, damit alle wissen, wie es Minna geht.",
  },
  {
    icon: ShieldCheck,
    title: "Gesundheit im Blick",
    description:
      "Hausmeisterteam und Tierärztin koordinieren Impfungen, Parasitenkuren und regelmäßige Check-ups, damit Minna fit bleibt.",
  },
  {
    icon: Fish,
    title: "Futterpatenschaften",
    description:
      "Klassen sammeln Lieblingssnacks, stimmen sich aber vorher mit der Pflege-AG ab – so bleibt der Speiseplan ausgewogen.",
  },
];

const guidelines: string[] = [
  "Minna entscheidet, wann sie Kontakt möchte – sanft fragen und Hände zuerst schnuppern lassen.",
  "Bitte keine mitgebrachten Leckerlis füttern; die Pflege-AG koordiniert eine abgestimmte Ernährung.",
  "Werkstatttüren langsam öffnen und Ruhebereiche wie das Requisitenlager respektieren.",
  "Bei Anzeichen von Stress oder Verletzungen sofort das Hausmeisterteam informieren.",
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
        <div className="max-w-3xl space-y-6">
          <Text variant="eyebrow" uppercase tone="primary">
            Schulkultur
          </Text>
          <Heading level="h1" className="mt-2">
            Unsere Schulkatze
          </Heading>
          <Text variant="bodyLg" tone="muted" className="mt-4">
            Minna begleitet Unterricht, Proben und Sommerabende im Schlosspark. Sie gehört fest zur Atmosphäre des Sommertheaters
            und erinnert uns daran, achtsam miteinander umzugehen.
          </Text>
          <Text tone="muted">
            Damit Minna sich auf dem Campus wohlfühlt, wirkt ein engagiertes Team zusammen: Pflege-AG, Hausmeisterei und Ensemble.
            Gemeinsam schaffen wir Rückzugsorte, Rituale und eine Versorgung, die ihren Bedürfnissen entspricht.
          </Text>
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
                Alltag mit Minna
              </Text>
            </div>
            <div className="space-y-4">
              {routine.map((entry) => (
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
              {supportNetwork.map((entry) => (
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
              Gute Begegnungen für Mensch und Tier
            </Text>
          </div>
          <div className="space-y-3">
            <Text variant="small" tone="muted">
              Damit sich Minna sicher fühlt, beachten wir gemeinsam ein paar Leitlinien:
            </Text>
            <ul className="space-y-2">
              {guidelines.map((guideline) => (
                <li key={guideline} className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 flex-none rounded-full bg-primary" aria-hidden />
                  <Text variant="small" tone="muted" className="leading-relaxed">
                    {guideline}
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
            Gemeinsam für Minna
          </Heading>
          <Text variant="bodyLg" tone="muted" align="center">
            Ob bei Proben, Aufführungen oder im Schulalltag – Minna sorgt für Gelassenheit und verbindet Generationen.
            Wer sie erlebt, spürt sofort den besonderen Charakter unseres Campus.
          </Text>
          <Text tone="muted" align="center">
            Du möchtest die Pflege-AG unterstützen oder neue Ideen einbringen? Melde dich unter{' '}
            <TextLink href="mailto:schulkatze@sommertheater-altrossthal.de">schulkatze@sommertheater-altrossthal.de</TextLink>.
          </Text>
        </div>
      </section>
    </div>
  );
}
