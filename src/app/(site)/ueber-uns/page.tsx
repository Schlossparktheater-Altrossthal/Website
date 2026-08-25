import {
  AudioLinesIcon,
  CalendarHeartIcon,
  ClipboardListIcon,
  DramaIcon,
  HeartHandshakeIcon,
  IconComponent,
  MegaphoneIcon,
  Music3Icon,
  PackageIcon,
  ShirtIcon,
  SparklesIcon,
  TreesIcon,
  UsersIcon,
  UtensilsCrossedIcon,
  WandSparklesIcon,
  ZapIcon,
} from "@/components/ui/action-icons";
export const revalidate = 60;

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CarouselHint } from "@/app/(site)/ueber-uns/carousel-hint";
import { Heading, Text } from "@/components/ui/typography";
import { getCurrentProductionEnsembleStats } from "@/lib/ensemble";
import { getPublicPageVisibility } from "@/lib/public-page-visibility";
import {
  readUeberUnsIntro,
  readUeberUnsMilestones,
  readUeberUnsSignature,
  readUeberUnsStats,
  readUeberUnsTrades,
  readUeberUnsValues,
} from "@/lib/website-content";

const ICON_MAP: Record<string, IconComponent> = {
  AudioLinesIcon,
  CalendarHeartIcon,
  ClipboardListIcon,
  DramaIcon,
  HeartHandshakeIcon,
  MegaphoneIcon,
  Music3Icon,
  PackageIcon,
  ShirtIcon,
  SparklesIcon,
  TreesIcon,
  UsersIcon,
  UtensilsCrossedIcon,
  WandSparklesIcon,
  ZapIcon,
};

const baseMetadata: Metadata = {
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

export async function generateMetadata(): Promise<Metadata> {
  const visibility = await getPublicPageVisibility();
  const enabled = visibility.about;
  return {
    ...baseMetadata,
    alternates: {
      canonical: "/ueber-uns",
    },
    robots: {
      index: enabled,
      follow: enabled,
    },
  };
}

type StatisticItem = {
  label: string;
  value: string;
  detail: string;
};

const NUMBER_FORMATTER = new Intl.NumberFormat("de-DE");

const CAROUSEL_GROUP_COUNT = 2;
const SECTION_HEADING_CLASS = "text-[clamp(1.2rem,2.5vw,1.8rem)] font-bold text-foreground";

export default async function PublicAboutPage() {
  const visibility = await getPublicPageVisibility();
  if (!visibility.about) {
    notFound();
  }
  const baseUrl = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  const [ensembleStats, intro, statsContent, milestones, signature, values, trades] =
    await Promise.all([
      getCurrentProductionEnsembleStats(),
      readUeberUnsIntro(),
      readUeberUnsStats(),
      readUeberUnsMilestones(),
      readUeberUnsSignature(),
      readUeberUnsValues(),
      readUeberUnsTrades(),
    ]);

  const statisticItems = statsContent.items.map<StatisticItem>((item) => {
    if (item.label !== "Ensemble" || !ensembleStats) {
      return item;
    }
    return {
      ...item,
      value: NUMBER_FORMATTER.format(ensembleStats.memberCount),
      detail: "Mitglieder in der aktuellen Produktion – Schauspieler auf der Bühne",
    };
  });
  const aboutOrganizationJsonLd = {
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
        <div
          className="absolute inset-0 bg-gradient-to-b from-background via-background/70 to-background"
          aria-hidden
        />
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
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <Heading
              level="h1"
              className="text-[clamp(1.2rem,2.5vw,1.8rem)] font-bold text-foreground"
            >
              Über uns
            </Heading>
            {intro.paragraphs.map((paragraph, index) => (
              <Text
                key={index}
                variant={index === 0 ? "bodyLg" : "body"}
                tone="muted"
                className={index === 0 ? "mt-6" : "mt-4"}
              >
                {paragraph}
              </Text>
            ))}
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {statisticItems.map((item) => (
              <Card
                key={item.label}
                className="flex flex-col items-center border border-primary/60 bg-card/70 p-4 text-center shadow-sm"
              >
                <CardHeader className="p-0 pb-2">
                  <p className="text-center text-xs font-semibold uppercase tracking-widest text-primary">
                    {item.label}
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-center text-[clamp(1.8rem,3vw,2.4rem)] font-bold text-primary">
                    {item.value}
                  </p>
                  <p className="mt-1 text-center text-sm text-muted-foreground">{item.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="layout-container pb-16 sm:pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <Heading level="h2" className={SECTION_HEADING_CLASS}>
              Gewerke, die eine Produktion tragen
            </Heading>
            <Text variant="bodyLg" tone="muted" className="mt-4">
              Jeder Sommer entsteht aus vielen Händen und Talenten. Unser Ensemble arbeitet
              bereichsübergreifend – von der ersten Textprobe bis zur letzten Vorstellungsnacht.
            </Text>
          </div>
          <div className="mt-4 flex justify-end">
            <CarouselHint />
          </div>
          <div className="group relative mt-8 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-hidden sm:px-0">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 hidden w-12 bg-gradient-to-r from-background via-background/80 to-transparent sm:block"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 hidden w-12 bg-gradient-to-l from-background via-background/80 to-transparent sm:block"
              aria-hidden
            />
            <div
              className="flex w-max gap-4 px-2 py-6 touch-pan-x snap-x snap-mandatory sm:gap-6 sm:px-6 sm:animate-carousel sm:touch-auto sm:snap-none group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:animate-none"
              role="list"
              aria-label="Gewerke des Ensembles"
              style={{ animationDuration: "75s" }}
            >
              {Array.from({ length: CAROUSEL_GROUP_COUNT }).map((_, groupIndex) => (
                <div key={groupIndex} className="flex gap-6" aria-hidden={groupIndex > 0}>
                  {trades.items.map(({ icon: iconName, title, description }) => {
                    const TradeIcon = ICON_MAP[iconName] ?? DramaIcon;
                    return (
                      <Card
                        key={`${title}-${groupIndex}`}
                        role={groupIndex === 0 ? "listitem" : "presentation"}
                        aria-hidden={groupIndex > 0}
                        tabIndex={groupIndex === 0 ? 0 : -1}
                        className="flex w-[min(18.5rem,80vw)] shrink-0 snap-center flex-col justify-between gap-4 rounded-2xl border border-primary/50 bg-card/70 p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:w-[22rem] sm:snap-start"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary">
                            <TradeIcon className="h-6 w-6" aria-hidden />
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
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="layout-container pb-16 sm:pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <Heading level="h2" className={SECTION_HEADING_CLASS}>
                Unsere Handschrift
              </Heading>
              <Text variant="bodyLg" tone="muted">
                Die Sommerproduktionen entstehen über Monate hinweg – von der ersten Idee bis zur
                letzten Generalprobe. Dabei verbinden wir poetische Stoffe mit immersiven
                Erlebnissen, die nur unter freiem Himmel möglich sind. Werkstätten für Floristik,
                Holz- und Metallgestaltung sowie Maskenbild des Berufsschulzentrums fließen direkt
                in Bühnenwelten ein.
              </Text>
              <div className="space-y-5">
                {signature.items.map(({ icon: iconName, title, description }) => {
                  const SignatureIcon = ICON_MAP[iconName] ?? DramaIcon;
                  return (
                    <div
                      key={title}
                      className="group flex gap-4 rounded-xl border border-border/40 bg-card/60 p-4 transition hover:border-primary/50 hover:bg-card/80"
                    >
                      <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <SignatureIcon className="h-6 w-6" aria-hidden />
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
                  );
                })}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-primary/10 via-background to-background p-[clamp(1rem,2vw,1.5rem)] shadow-lg">
              <div
                className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(248,223,150,0.18),_transparent_60%)]"
                aria-hidden
              />
              <div className="relative space-y-4">
                <Text variant="eyebrow" uppercase tone="primary">
                  Atmosphäre
                </Text>
                <Heading level="h3" className="text-[clamp(1rem,2vw,1.3rem)] font-bold">
                  Wenn die Sonne hinter den Baumwipfeln verschwindet, beginnt unser Bühnenraum zu
                  leben: leuchtende Pfade, flüsternde Bäume und ein Ensemble, das das Publikum
                  mitnimmt in eine andere Welt.
                </Heading>
                <Text variant="small" tone="muted">
                  Jedes Szenenbild wird speziell für den Schlosspark entwickelt. Lichtinstallationen
                  und räumlicher Klang lassen die Besucher:innen mitten in der Geschichte stehen.
                </Text>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="layout-container pb-16 sm:pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl">
            <Heading level="h2" className={SECTION_HEADING_CLASS}>
              Werte, die wir leben
            </Heading>
            <Text variant="bodyLg" tone="muted" className="mt-4">
              Ensemblearbeit bedeutet Vertrauen. Unsere Werte spiegeln sich in jeder Probe, jedem
              Ehrenamt und jedem Gast wider, der den Weg nach Altrossthal findet.
            </Text>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {values.items.map(({ icon: iconName, title, description }) => {
              const ValueIcon = ICON_MAP[iconName] ?? DramaIcon;
              return (
                <Card key={title} className="relative overflow-hidden bg-card/70">
                  <div
                    className="absolute right-4 top-4 h-16 w-16 rounded-full bg-primary/10 blur-2xl"
                    aria-hidden
                  />
                  <CardHeader>
                    <ValueIcon className="h-8 w-8 text-primary" aria-hidden />
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="text-xl">{title}</CardTitle>
                    <Text variant="small" tone="muted" className="mt-2">
                      {description}
                    </Text>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="layout-container pb-16 sm:pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <Heading level="h2" className={SECTION_HEADING_CLASS}>
                Meilensteine
              </Heading>
              <Text variant="bodyLg" tone="muted" className="mt-4">
                Wir wachsen organisch und mit viel Leidenschaft. Ein paar Stationen auf unserem Weg:
              </Text>
            </div>
            <div className="relative">
              <div
                className="absolute left-3 top-1 bottom-1 w-px bg-gradient-to-b from-primary/60 via-primary/20 to-transparent"
                aria-hidden
              />
              <ul className="space-y-8">
                {milestones.items.map((milestone, index) => (
                  <li key={index} className="relative pl-12">
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
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutOrganizationJsonLd) }}
      />
    </div>
  );
}
