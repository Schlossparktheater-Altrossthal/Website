import type { Metadata } from "next";

import { Heading, Text } from "@/components/ui/typography";
import {
  DIETARY_STRICTNESS_OPTIONS,
  DIETARY_STYLE_OPTIONS,
  NONE_STRICTNESS_LABEL,
} from "@/data/dietary-preferences";

export const metadata: Metadata = {
  title: "Kochen & Essen",
  description:
    "Alle Ernährungsstile, Strengegrade und Allergie-Level des Sommertheaters Altrossthal auf einen Blick.",
  alternates: {
    canonical: "/kochen-und-essen",
  },
  openGraph: {
    title: "Kochen & Essen | Sommertheater Altrossthal",
    description:
      "Koordinationsseite für Verpflegung: Ernährung, Unverträglichkeiten und Allergie-Level in einer Übersicht.",
    url: "/kochen-und-essen",
    type: "website",
  },
};

type DietaryStyleValue = (typeof DIETARY_STYLE_OPTIONS)[number]["value"];
type DietaryStrictnessValue = (typeof DIETARY_STRICTNESS_OPTIONS)[number]["value"];

type DietaryEntry = {
  key: string;
  category: string;
  label: string;
  description: string;
};

const styleDescriptions: Record<DietaryStyleValue, string> = {
  none: "Standardverpflegung ohne besondere Anforderungen – wir kalkulieren mit klassischer Mischkost.",
  omnivore: "Gemischte Kost mit allem, was die Küche bietet. Wir planen mit Fleisch-, Fisch- und vegetarischen Optionen.",
  vegetarian: "Ohne Fleisch und Fisch – Milchprodukte und Eier sind in Ordnung, sofern nichts anderes vermerkt ist.",
  vegan: "Komplett pflanzliche Ernährung. Wir achten auf separate Zubereitung und klare Kennzeichnung.",
  pescetarian: "Fisch ist willkommen, Fleisch vermeiden wir. Perfekt für leichte Sommergerichte.",
  flexitarian: "Grundsätzlich offen, aber mit Wunsch nach bewusster Auswahl. Wir priorisieren saisonale, gemüsereiche Angebote.",
  halal: "Zutaten und Zubereitung orientieren sich an halal-konformen Vorgaben. Wir kennzeichnen passende Speisen eindeutig.",
  kosher: "Wir berücksichtigen koschere Lebensmittelstandards und stimmen Menüfolgen vorher ab.",
  custom: "Individueller Stil – beschreibe im Profil, worauf wir besonders achten sollen.",
};

const strictnessDescriptions: Record<DietaryStrictnessValue, string> = {
  strict: "Keine Ausnahmen möglich. Wir bereiten separate Portionen vor und halten Rücksprache bei Fragen.",
  flexible: "Kleine Abweichungen sind in Ordnung – ideal, wenn einzelne Zutaten ersetzt werden können.",
  situational: "Je nach Situation oder Veranstaltung. Wir melden uns für Details und stimmen Alternativen ab.",
};

const allergyEntries: DietaryEntry[] = [
  {
    key: "allergy-mild",
    category: "Allergie-Level",
    label: "Leicht (Unbehagen)",
    description:
      "Leichte Reaktionen wie Unwohlsein oder Hautreizungen. Wir markieren Speisen und bieten Alternativen an.",
  },
  {
    key: "allergy-moderate",
    category: "Allergie-Level",
    label: "Mittel (Allergische Reaktion)",
    description:
      "Reaktionen sind spürbar, aber meist beherrschbar. Wir halten Rücksprache über Symptome und Notfallpläne.",
  },
  {
    key: "allergy-severe",
    category: "Allergie-Level",
    label: "Schwer (Notfall möglich)",
    description:
      "Es können starke allergische Reaktionen auftreten. Wir planen strikt getrennt und haben Ansprechpartner:innen parat.",
  },
  {
    key: "allergy-lethal",
    category: "Allergie-Level",
    label: "Lebensbedrohlich",
    description:
      "Schon kleinste Mengen können lebensgefährlich sein. Wir prüfen Zutatenketten und besprechen Notfallabläufe im Detail.",
  },
];

const combinedEntries: DietaryEntry[] = [
  ...DIETARY_STYLE_OPTIONS.map<DietaryEntry>((option) => ({
    key: `style-${option.value}`,
    category: "Ernährungsstil",
    label: option.label,
    description: styleDescriptions[option.value],
  })),
  ...DIETARY_STRICTNESS_OPTIONS.map<DietaryEntry>((option) => ({
    key: `strictness-${option.value}`,
    category: "Strengegrad",
    label: option.label,
    description: strictnessDescriptions[option.value],
  })),
  {
    key: "strictness-none",
    category: "Strengegrad",
    label: NONE_STRICTNESS_LABEL,
    description:
      "Für alle, die keinen besonderen Fokus benötigen – wir greifen auf das Standardbuffet zurück.",
  },
  ...allergyEntries,
];

const supportSteps: string[] = [
  "Pflege deinen Ernährungsstil und Allergien im Mitgliederprofil – dort landet alles in dieser Übersicht.",
  "Aktualisiere Einträge direkt nach Änderungen, damit Küche und Orga kurzfristig reagieren können.",
  "Melde dich bei schweren Unverträglichkeiten zusätzlich per E-Mail an das Verpflegungsteam.",
];

export default function CookingAndDiningPage() {
  return (
    <div className="relative isolate">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" aria-hidden />
        <div
          className="absolute left-1/2 top-[-10%] h-[26rem] w-[110vw] -translate-x-1/2 bg-gradient-to-r from-primary/15 via-primary/10 to-transparent blur-3xl opacity-60"
          aria-hidden
        />
        <div
          className="absolute right-[-15%] bottom-[-20%] h-[20rem] w-[80vw] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent blur-3xl opacity-50"
          aria-hidden
        />
      </div>

      <div className="layout-container space-y-12 pb-16 pt-16 sm:space-y-16 sm:pb-20 sm:pt-24">
        <section className="max-w-3xl space-y-4">
          <Text variant="eyebrow" tone="primary" uppercase>
            Kochen & Essen
          </Text>
          <Heading level="h1">Ernährung & Verträglichkeiten im Überblick</Heading>
          <Text variant="bodyLg" tone="muted">
            Wir bündeln hier alle Angaben, die unser Ensemble für Proben, Aufführungen und Gemeinschaftsabende braucht. So
            stellen wir sicher, dass jede:r passende Verpflegung erhält und sich wohlfühlt.
          </Text>
          <Text tone="muted">
            Die Kategorien stammen aus dem Mitgliederbereich. Du kannst sie jederzeit anpassen – Änderungen landen sofort im
            Orga-Board für Küche und Logistik.
          </Text>
        </section>

        <section className="space-y-6">
          <Heading level="h2" className="text-h3">
            Alle Ernährungseinträge auf einen Blick
          </Heading>
          <Text tone="muted">
            Die Liste kombiniert Ernährungsstile, gewünschte Strengegrade und Allergie-Level. Damit planen wir Buffets, Kochteams
            und Einkaufsliste für jede Produktion.
          </Text>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {combinedEntries.map((entry) => (
              <li
                key={entry.key}
                className="flex h-full flex-col justify-between rounded-xl border border-border/60 bg-background/85 p-5 shadow-sm"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">
                  {entry.category}
                </span>
                <p className="mt-2 text-lg font-semibold text-foreground">{entry.label}</p>
                <p className="mt-3 text-sm text-muted-foreground">{entry.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <Heading level="h2" className="text-h3">
            So arbeiten wir mit deinen Angaben
          </Heading>
          <Text tone="muted">
            Damit die Küche entspannt planen kann, helfen uns folgende Schritte. Bitte teile das auch neuen Ensemble-Mitgliedern
            mit.
          </Text>
          <ul className="list-disc space-y-2 pl-6 text-sm text-muted-foreground">
            {supportSteps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ul>
          <Text variant="small" tone="muted">
            Fragen oder kurzfristige Notfälle? Schreib an <a className="underline" href="mailto:verpflegung@sommertheater-altrossthal.de">verpflegung@sommertheater-altrossthal.de</a>
            – wir koordinieren direkt mit dem Kochteam.
          </Text>
        </section>
      </div>
    </div>
  );
}
