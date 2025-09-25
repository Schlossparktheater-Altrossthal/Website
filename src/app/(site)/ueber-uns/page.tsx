import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AudioLines,
  CalendarHeart,
  ClipboardList,
  Drama,
  HeartHandshake,
  MapPin,
  Megaphone,
  Music3,
  Package,
  Paintbrush,
  Shirt,
  Sparkles,
  Spotlight,
  Trees,
  Users,
  UtensilsCrossed,
  WandSparkles,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heading, Text } from "@/components/ui/typography";
import { getCurrentProductionEnsembleStats } from "@/lib/ensemble";

export const metadata: Metadata = {
  title: "Über uns",
  description:
    "Lerne das Sommertheater Altrossthal kennen – unser Ensemble, unsere Werte und die Menschen, die jeden Sommer magische Abende im Schlosspark schaffen.",
  alternates: {
    canonical: "/ueber-uns",
  },
  openGraph: {
    title: "Über uns | Sommertheater Altrossthal",
    description:
      "Unser Ensemble, unsere Geschichte und unsere Mission: Sommertheater Altrossthal im Portrait.",
    url: "/ueber-uns",
    type: "website",
  },
};

type Highlight = {
  label: string;
  value: string;
  detail: string;
};

const NUMBER_FORMATTER = new Intl.NumberFormat("de-DE");

const baseHighlights: Highlight[] = [
  {
    label: "Gründung",
    value: "2009",
    detail: "Premiere mit \"Die lustigen Weiber von Windsor\" im Schlosspark",
  },
  {
    label: "Ensemble",
    value: "45+",
    detail: "Darstellende, Musiker:innen und helfende Hände",
  },
  {
    label: "Publikum",
    value: "400+",
    detail: "Gäste pro Aufführung",
  },
  {
    label: "Aufführungen",
    value: "4",
    detail: "pro Saison",
  },
];

const signature = [
  {
    icon: Drama,
    title: "Freiluftbühne im Schlosspark",
    description:
      "Wir verwandeln historische Mauern und alte Baumkronen in eine Bühne voller Atmosphären, Licht und Klang.",
  },
  {
    icon: Sparkles,
    title: "Storytelling mit Tiefgang",
    description:
      "Jedes Stück entsteht eigens für Altrossthal – poetisch, geheimnisvoll und nah an den Menschen, die uns umgeben.",
  },
  {
    icon: Trees,
    title: "Schulgelände voller Gewerke",
    description:
      "Schüler:innen des BSZ Altroßthal bringen Floristik, Holz- und Metallbau ein – so wachsen Bühne, Kostüm und Szenografie Hand in Hand.",
  },
];

const values = [
  {
    icon: HeartHandshake,
    title: "Gemeinschaft",
    description:
      "Im Ensemble wirken Generationen zusammen. Ehrenamt, Professionalität und Nachbarschaft greifen ineinander.",
  },
  {
    icon: Users,
    title: "Offenheit",
    description:
      "Wir schaffen Räume, in denen neue Stimmen hörbar werden – auf der Bühne, in den Werkstätten und beim Ausprobieren neuer Gewerke.",
  },
  {
    icon: CalendarHeart,
    title: "Sorgfalt",
    description:
      "Jedes Detail zählt: von der Dramaturgie über die Kostüme bis zur letzten Bankreihe im Park.",
  },
];

const milestones = [
  {
    year: "2009",
    title: "Die erste Inszenierung",
    description:
      "Toni Burghard Friedrich initiiert das Sommertheater mit \"Die lustigen Weiber von Windsor\" und schafft einen neuen Ort für Schüler:innen des BSZ.",
  },
  {
    year: "2012",
    title: "Floristik trifft Bühne",
    description:
      "Florist:innen gestalten erstmals lebendige Bühnenbilder aus regionalen Pflanzen und geben dem Park seine ikonischen Duftinseln.",
  },
  {
    year: "2017",
    title: "Werkstatt-Ateliers",
    description:
      "Neue Workshops ermöglichen Schüler:innen, sich in Lichttechnik, Metallbau und Kostümhandwerk auszuprobieren und Verantwortung zu übernehmen.",
  },
  {
    year: "2023",
    title: "Digital verbunden",
    description:
      "Livestreams für Menschen, die nicht vor Ort sein können, und ein hybrides Probenformat für unser Ensemble.",
  },
];

const engagement = [
  {
    title: "Mitmachen",
    description:
      "Ob Schauspiel, Kostüm, Floristik, Metallwerkstatt, Werbung & Social Media oder Gästebetreuung – wir freuen uns über neue Gesichter, die mit uns die Sommertheater-Momente gestalten.",
    action: {
      label: "Schreib uns",
      href: "mailto:ensemble@sommertheater-altrossthal.de",
    },
  },
  {
    title: "Fördern",
    description:
      "Als Partner:in oder Sponsor:in stärkst du kulturelle Angebote in der Region und ermöglichst faire Gagen für unser Kreativteam.",
    action: {
      label: "Kontakt aufnehmen",
      href: "mailto:foerderkreis@sommertheater-altrossthal.de",
    },
  },
];

type Trade = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const trades: Trade[] = [
  {
    icon: Drama,
    title: "Schauspiel",
    description:
      "Wir entwickeln Szenen gemeinsam und finden für jede Person die passende Herausforderung – vom leisen Spiel bis zur großen Hauptrolle.",
  },
  {
    icon: Spotlight,
    title: "Technik",
    description:
      "Scheinwerfer, Funkmikros und Klangflächen sorgen für Atmosphäre. Unser Technikteam mischt, programmiert und begleitet jede Vorstellung live.",
  },
  {
    icon: Paintbrush,
    title: "Bühnenbau & -malerei",
    description:
      "Holz, Stoffe und frische Floristik verschmelzen zu verwunschenen Parklandschaften. Hier entstehen Wege, Kulissen und Farbräume.",
  },
  {
    icon: Package,
    title: "Requisite",
    description:
      "Vom alten Koffer bis zum magischen Artefakt – die Requisite recherchiert, baut und pflegt alles, was Figuren in den Händen halten.",
  },
  {
    icon: Shirt,
    title: "Kostüm",
    description:
      "Outfits werden entworfen, zugeschnitten und veredelt. So erzählen Stoffe, Farben und Accessoires eigene Geschichten.",
  },
  {
    icon: WandSparkles,
    title: "Maske",
    description:
      "Mit Pinseln, Airbrush und viel Fingerspitzengefühl entstehen Charaktere – vom sommerlichen Glow bis hin zu fantastischen Wesen.",
  },
  {
    icon: Megaphone,
    title: "Werbung",
    description:
      "Stories, Reels und Plakatideen machen Probenprozesse sichtbar und laden unser Publikum frühzeitig in den Schlosspark ein.",
  },
  {
    icon: AudioLines,
    title: "Soufflage",
    description:
      "Mit Textbuch und Ruhe bewahren die Souffleur:innen den Überblick – und geben im richtigen Moment leise Stichworte.",
  },
  {
    icon: Music3,
    title: "Musik",
    description:
      "Eigenkompositionen, Chorarrangements und choreografierte Bewegungen verweben Klang und Rhythmus mit der Handlung.",
  },
  {
    icon: UtensilsCrossed,
    title: "Verpflegung",
    description:
      "Snacks für lange Probentage und liebevoll gedeckte Buffets vor den Shows halten Ensemble und Gäste bei Kräften.",
  },
  {
    icon: ClipboardList,
    title: "Regieassistenz & Organisation",
    description:
      "Spielpläne, Probenprotokolle und Kontaktlisten laufen hier zusammen – damit jede Premiere punktgenau gelingt.",
  },
];

export default async function AboutPage() {
  const baseUrl = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  const ensembleStats = await getCurrentProductionEnsembleStats();
  const highlights = baseHighlights.map<Highlight>((item) => {
    if (item.label !== "Ensemble" || !ensembleStats) {
      return item;
    }

    return {
      ...item,
      value: NUMBER_FORMATTER.format(ensembleStats.memberCount),
      detail: "Mitglieder in der aktuellen Produktion – Darstellende, Musiker:innen und helfende Hände",
    };
  });
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "PerformingGroup",
    name: "Sommertheater Altrossthal",
    description:
      "Ein gemeinnütziges Sommertheater-Ensemble, das jedes Jahr immersive Freiluftinszenierungen im Schlosspark Altrossthal zeigt.",
    url: `${baseUrl}/ueber-uns`,
    foundingDate: "2009",
    founder: {
      "@type": "Person",
      name: "Toni Burghard Friedrich",
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Altrossthal",
      addressRegion: "Schleswig-Holstein",
      addressCountry: "DE",
    },
    sameAs: [`${baseUrl}/chronik`, `${baseUrl}/mystery`],
  } as const;

  return (
    <div className="relative isolate">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/70 to-background" aria-hidden />
        <div
          className="absolute left-1/2 top-[-10%] h-[28rem] w-[120vw] -translate-x-1/2 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent blur-3xl opacity-60"
          aria-hidden
        />
        <div
          className="absolute right-[-10%] bottom-[-20%] h-[22rem] w-[90vw] bg-gradient-to-br from-primary/25 via-primary/5 to-transparent blur-3xl opacity-50"
          aria-hidden
        />
      </div>

      <section className="layout-container pb-12 pt-16 sm:pt-24">
        <div className="max-w-3xl">
          <Text variant="eyebrow" uppercase tone="primary">
            Sommertheater Altrossthal
          </Text>
          <Heading level="h1" className="mt-4">
            Über uns
          </Heading>
          <Text variant="bodyLg" tone="muted" className="mt-6">
            Wir erzählen Geschichten für laue Sommernächte. Unser Ensemble verbindet professionelle Theaterarbeit mit ehrenamtlichem Herzblut – mitten im
            Schlosspark Altrossthal.
          </Text>
          <Text tone="muted" className="mt-4">
            Gegründet wurde das Sommertheater 2009 vom damaligen Schüler Toni Burghard Friedrich. Seitdem treffen sich Lernende, Alumni und Freund:innen des
            BSZ Altroßthal, um eine Bühne zu schaffen, die weit über klassischen Unterricht hinausgeht.
          </Text>
          <Text tone="muted" className="mt-4">
            Das Ensemble besteht aus Schüler:innen des Beruflichen Gymnasiums und der Fachoberschule, Auszubildenden aus Landwirtschaft, Floristik, Konditorei
            und vielen weiteren Gewerken sowie Freund:innen des Beruflichen Schulzentrums für Agrarwirtschaft und Ernährung Dresden.
          </Text>
          <Text tone="muted" className="mt-4">
            Die Regie übernehmen meist professionelle Schauspieler:innen oder Regisseur:innen, die ihre Erfahrung teilen und gemeinsam mit uns neue Sommerstücke
            entwickeln.
          </Text>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {highlights.map((item) => (
            <Card key={item.label} className="bg-card/70">
              <CardHeader>
                <p className="text-sm uppercase tracking-wide text-muted-foreground/80">{item.label}</p>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-primary">{item.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="layout-container pb-16 sm:pb-24">
        <div className="max-w-3xl">
          <Heading level="h2">Gewerke, die eine Produktion tragen</Heading>
          <Text variant="bodyLg" tone="muted" className="mt-4">
            Jeder Sommer entsteht aus vielen Händen und Talenten. Unser Ensemble arbeitet bereichsübergreifend – von der ersten Textprobe bis zur letzten
            Vorstellungsnacht.
          </Text>
          <Text tone="muted" className="mt-2">
            Scroll durch die Werkstätten und entdecke, wie vielfältig Theaterarbeit am BSZ Altroßthal ist.
          </Text>
        </div>
        <div className="relative mt-8">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background via-background/80 to-transparent"
            aria-hidden
          />
          <div
            className="flex gap-6 overflow-x-auto pb-6 pr-6 [scrollbar-color:theme(colors.primary/40)_transparent] [scrollbar-width:thin]"
            role="list"
            aria-label="Gewerke des Ensembles"
          >
            {trades.map(({ icon: Icon, title, description }) => (
              <Card
                key={title}
                role="listitem"
                className="flex w-[min(22rem,80vw)] shrink-0 snap-start flex-col justify-between gap-4 rounded-2xl border-border/40 bg-card/70 p-6 shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Icon className="h-6 w-6" aria-hidden />
                  </div>
                  <Heading level="h3" className="text-xl" weight="bold">
                    {title}
                  </Heading>
                </div>
                <div className="space-y-3">
                  <Text variant="small" tone="muted">
                    {description}
                  </Text>
                </div>
              </Card>
            ))}
          </div>
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background via-background/80 to-transparent"
            aria-hidden
          />
        </div>
        <Text variant="small" tone="muted" className="mt-4">
          Tipp: Mit dem horizontalen Scrollbalken oder per Wischgeste kannst du alle Gewerke entdecken.
        </Text>
      </section>

      <section className="layout-container pb-16 sm:pb-24">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <Heading level="h2">Unsere Handschrift</Heading>
            <Text variant="bodyLg" tone="muted">
              Die Sommerproduktionen entstehen über Monate hinweg – von der ersten Idee bis zur letzten Generalprobe. Dabei verbinden wir poetische Stoffe mit
              immersiven Erlebnissen, die nur unter freiem Himmel möglich sind. Werkstätten für Floristik, Holz- und Metallgestaltung sowie Maskenbild des
              Berufsschulzentrums fließen direkt in Bühnenwelten ein.
            </Text>
            <div className="space-y-5">
              {signature.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="group flex gap-4 rounded-xl border border-border/40 bg-card/60 p-4 transition hover:border-primary/50 hover:bg-card/80"
                >
                  <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Icon className="h-6 w-6" aria-hidden />
                  </div>
                  <div>
                    <Heading level="h4" className="text-lg" weight="bold">
                      {title}
                    </Heading>
                    <Text variant="small" tone="muted" className="mt-1">
                      {description}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-primary/10 via-background to-background p-8 shadow-lg">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(248,223,150,0.18),_transparent_60%)]" aria-hidden />
            <div className="relative space-y-4">
              <Text variant="eyebrow" uppercase tone="primary">
                Atmosphäre
              </Text>
              <Heading level="h3" className="text-2xl">
                Wenn die Sonne hinter den Baumwipfeln verschwindet, beginnt unser Bühnenraum zu leben: leuchtende Pfade, flüsternde Bäume und ein Ensemble, das
                das Publikum mitnimmt in eine andere Welt.
              </Heading>
              <Text variant="small" tone="muted">
                Jedes Szenenbild wird speziell für den Schlosspark entwickelt. Lichtinstallationen und räumlicher Klang lassen die Besucher:innen mitten in der
                Geschichte stehen.
              </Text>
            </div>
          </div>
        </div>
      </section>

      <section className="layout-container pb-16 sm:pb-24">
        <div className="max-w-2xl">
          <Heading level="h2">Werte, die wir leben</Heading>
          <Text variant="bodyLg" tone="muted" className="mt-4">
            Ensemblearbeit bedeutet Vertrauen. Unsere Werte spiegeln sich in jeder Probe, jedem Ehrenamt und jedem Gast wider, der den Weg nach Altrossthal findet.
          </Text>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {values.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="relative overflow-hidden bg-card/70">
              <div className="absolute right-4 top-4 h-16 w-16 rounded-full bg-primary/10 blur-2xl" aria-hidden />
              <CardHeader>
                <Icon className="h-8 w-8 text-primary" aria-hidden />
              </CardHeader>
              <CardContent>
                <CardTitle className="text-xl">{title}</CardTitle>
                <Text variant="small" tone="muted" className="mt-2">
                  {description}
                </Text>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="layout-container pb-16 sm:pb-24">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <Heading level="h2">Meilensteine</Heading>
            <Text variant="bodyLg" tone="muted" className="mt-4">
              Wir wachsen organisch und mit viel Leidenschaft. Ein paar Stationen auf unserem Weg:
            </Text>
          </div>
          <div className="relative">
            <div className="absolute left-3 top-1 bottom-1 w-px bg-gradient-to-b from-primary/60 via-primary/20 to-transparent" aria-hidden />
            <ul className="space-y-8">
              {milestones.map((milestone) => (
                <li key={milestone.year} className="relative pl-12">
                  <div className="absolute left-0 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-primary/50 bg-primary/20 text-primary">
                    <span className="text-xs font-semibold">{milestone.year}</span>
                  </div>
                  <Heading level="h4" className="text-lg" weight="bold">
                    {milestone.title}
                  </Heading>
                  <Text variant="small" tone="muted" className="mt-2">
                    {milestone.description}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="layout-container pb-20 sm:pb-28">
        <div className="rounded-3xl border border-border/40 bg-card/60 p-8 sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-5">
              <Heading level="h2">Engagement rund um das Ensemble</Heading>
              <Text variant="bodyLg" tone="muted">
                Unser Sommertheater lebt von Menschen, die ihre Zeit und ihr Können einbringen. Wir begleiten neue Mitglieder mit Mentoring-Formaten, öffnen die
                Werkstätten des BSZ Altroßthal für Floristik, Holz und Metall und bieten Fortbildungen für Licht, Ton und Bühnenbild an.
              </Text>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <MapPin className="h-5 w-5 text-primary" aria-hidden />
                <span>Schlosspark Altrossthal · Probenscheune im Alten Forsthaus</span>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {engagement.map((item) => (
                <div key={item.title} className="rounded-2xl border border-border/40 bg-background/70 p-5">
                  <Heading level="h4" className="text-lg" weight="bold">
                    {item.title}
                  </Heading>
                  <Text variant="small" tone="muted" className="mt-2">
                    {item.description}
                  </Text>
                  <Link
                    href={item.action.href}
                    className="mt-4 inline-flex items-center text-sm font-medium text-primary hover:text-primary/80"
                  >
                    {item.action.label}
                    <span className="ml-2 text-lg" aria-hidden>
                      →
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
