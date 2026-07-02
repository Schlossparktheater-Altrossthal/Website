import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Heading, Text } from "@/components/ui/typography";
import { ArrowRightIcon, BookOpenTextIcon, CatIcon, UsersIcon } from "@/components/ui/action-icons";

type HomepageLinkCard = {
  href: string;
  title: string;
  description: string;
  Icon: LucideIcon;
};

const LINK_CARDS: HomepageLinkCard[] = [
  {
    href: "/ueber-uns",
    title: "Über uns",
    description: "Unser Ensemble, unsere Geschichte und unsere Arbeitsweise.",
    Icon: UsersIcon,
  },
  {
    href: "/unsere-schulkatze",
    title: "Unsere Schulkatze",
    description: "Die wichtigste tierische Begleitung rund um den Theateralltag.",
    Icon: CatIcon,
  },
  {
    href: "/chronik",
    title: "Chronik",
    description: "Ein Blick auf vergangene Produktionen und prägende Momente.",
    Icon: BookOpenTextIcon,
  },
];

export function HomepageLinkCards() {
  return (
    <section aria-labelledby="home-links-heading" className="space-y-6">
      <div className="text-center">
        <Heading id="home-links-heading" level="h2" align="center" className="text-[clamp(1.8rem,4vw,2.6rem)] font-bold">
          Mehr entdecken
        </Heading>
        <Text tone="muted" className="mt-3">
          Drei Seiten, die den Überblick über das Sommertheater erweitern.
        </Text>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {LINK_CARDS.map(({ href, title, description, Icon }) => (
          <Card key={href} className="group h-full border border-border/60 bg-card/90 p-0 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
            <Link href={href} className="flex h-full flex-col gap-4 p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted text-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowRightIcon className="mt-1 h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
              <div className="space-y-2">
                <Heading level="h3" className="text-xl font-semibold">
                  {title}
                </Heading>
                <Text tone="muted" className="leading-relaxed">
                  {description}
                </Text>
              </div>
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}
