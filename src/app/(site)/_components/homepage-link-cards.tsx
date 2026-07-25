import Link from "next/link";
import type { ReactNode, SVGProps } from "react";

import { Card } from "@/components/ui/card";
import { Heading, Text } from "@/components/ui/typography";
import { BookOpenTextIcon, CatIcon, UsersIcon } from "@/components/ui/action-icons";

type HomepageLinkCard = {
  href: string;
  title: string;
  description: string;
  Icon: (props: SVGProps<SVGSVGElement>) => ReactNode;
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
    <section aria-labelledby="home-links-heading" className="mb-56 space-y-6">
      <div className="text-center">
        <Heading id="home-links-heading" level="h2" align="center" className="text-[clamp(1.8rem,4vw,2.6rem)] font-bold">
          Mehr entdecken
        </Heading>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {LINK_CARDS.map(({ href, title, description, Icon }) => (
          <Card key={href} className="group flex h-full items-start border border-primary/60 bg-card/70 p-5 text-left shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <Link href={href} className="flex h-full w-full flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <div className="flex flex-row items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/60 bg-muted text-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex flex-col gap-1">
                  <Heading level="h3" className="text-xl font-semibold">
                    {title}
                  </Heading>
                  <Text tone="muted" className="leading-relaxed">
                    {description}
                  </Text>
                </div>
              </div>
              <div className="mt-3 flex justify-center">
                <span className="inline-flex w-auto items-center justify-center rounded-full border border-primary px-6 py-1.5 text-base font-semibold text-primary transition-all duration-200 group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-lg">
                  Mehr lesen
                </span>
              </div>
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}
