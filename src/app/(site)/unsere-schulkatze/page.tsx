export const revalidate = 60;

import { readdirSync } from "node:fs";
import path from "node:path";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Cat, Heart, MoonStar, PawPrint, ShieldCheck, Sun } from "lucide-react";

import { Card } from "@/components/ui/card";
import { TextLink } from "@/components/ui/text-link";
import { Heading, Text } from "@/components/ui/typography";
import { getPublicPageVisibility } from "@/lib/public-page-visibility";
import { readSchulkatzeIntro } from "@/lib/website-content";

import { CatMemorySection } from "./encounters-section";
import { CatGallery } from "./schulkatze-gallery";

const SUPPORTED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

function resolveCatImages(): string[] {
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

const catImages = resolveCatImages();

const baseMetadata: Metadata = {
  title: "Unsere Schulkatze",
  description:
    "Wir erinnern uns an Dieter Dennis von Altroßthal, die grau getigerte Schulkatze des BSZ Altrossthal, und erzählen seine Geschichte.",
  alternates: {
    canonical: "/unsere-schulkatze",
  },
  openGraph: {
    title: "Unsere Schulkatze | Sommertheater Altrossthal",
    description:
      "Porträt und Erinnerungen an Dieter, unsere grau getigerte Schulkatze, die uns über viele Jahre begleitet hat.",
    url: "/unsere-schulkatze",
    type: "website",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const visibility = await getPublicPageVisibility();
  const enabled = visibility.schoolCat ?? true;
  return {
    ...baseMetadata,
    alternates: {
      canonical: "/unsere-schulkatze",
    },
    robots: {
      index: enabled,
      follow: enabled,
    },
  };
}


type CatProfileHighlight = {
  icon: LucideIcon;
  title: string;
  description: string;
};

type CatMemoryItem = {
  icon: LucideIcon;
  title: string;
  detail: string;
};


const catCareLessons: string[] = [
  "Tiere, die unsere Schule begleiten, brauchen feste Bezugspersonen und klare Absprachen – Dieter hat uns das gelehrt.",
  "Gemeinsame Rituale schaffen Vertrauen, besonders wenn ein Vierbeiner über so viele Jahre Teil der Gemeinschaft ist.",
  "In Abschiedsmomenten hilft es, Erinnerungen zu teilen und Orte des Gedenkens zu schaffen.",
  "Wer künftig eine Schulkatze willkommen heißt, sollte an Dieters Bedürfnisse denken: Ruhe, Respekt und Zeit.",
];

export default async function SchoolCatPage() {
  const visibility = await getPublicPageVisibility();
  if (!visibility.schoolCat) {
    notFound();
  }
  const introContent = await readSchulkatzeIntro();
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
            {introContent.paragraphs.map((paragraph, index) => (
              <Text key={index} variant={index === 0 ? "bodyLg" : "body"} tone="muted" className={index === 0 ? "mt-4" : undefined}>
                {paragraph}
              </Text>
            ))}
          </div>
          <CatGallery
            images={catImages}
            alt="Schulkatze Dieter Dennis von Altroßthal, grau getigert, sitzt aufmerksam im Schulhof."
            caption="Dieter Dennis von Altroßthal war über viele Jahre Teil unserer Schulgemeinschaft."
          />
        </div>
      </section>


      <CatMemorySection />

    </div>
  );
}
