/**
 * Demo-Umgebung (demo.sommertheater-altrossthal.de, docs/demo.md).
 *
 * Mit `DEMO_MODE=true` zeigt die Login-Seite Rollen-Buttons statt Passwortmaske:
 * ein Klick meldet als eine der fiktiven Demo-Personen an. Die Daten legt
 * `scripts/demo/seed.ts` an und setzt sie nachts zurück. Nie in Produktion oder
 * Staging setzen – dort gibt es echte Konten.
 */

export type DemoPersona = {
  /** Feste ID aus dem Demo-Seed: Sitzungen überleben so den nächtlichen Reset. */
  id: string;
  email: string;
  name: string;
  label: string;
  description: string;
};

export const DEMO_EMAIL_DOMAIN = "demo.sommertheater-altrossthal.de";

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: "demo-user-lena",
    email: `lena.hoffmann@${DEMO_EMAIL_DOMAIN}`,
    name: "Lena Hoffmann",
    label: "Ensemble",
    description: "Spielt die Hermia: Proben, Sperrliste, Rolle, Kalender-Abo.",
  },
  {
    id: "demo-user-jonas",
    email: `jonas.weber@${DEMO_EMAIL_DOMAIN}`,
    name: "Jonas Weber",
    label: "Gewerkleitung Bühnenbau",
    description: "Leitet den Bühnenbau: Aufgaben, Bautage, Lager und Projekte.",
  },
  {
    id: "demo-user-miriam",
    email: `miriam.schubert@${DEMO_EMAIL_DOMAIN}`,
    name: "Miriam Schubert",
    label: "Regie",
    description: "Plant Proben, Szenen, Besetzung und die Endprobenwoche.",
  },
  {
    id: "demo-user-thomas",
    email: `thomas.richter@${DEMO_EMAIL_DOMAIN}`,
    name: "Thomas Richter",
    label: "Vorstand & Finanzen",
    description: "Produktionen, Meilensteine, Finanzen, Mitglieder und Fotoerlaubnisse.",
  },
  {
    id: "demo-user-admin",
    email: `admin@${DEMO_EMAIL_DOMAIN}`,
    name: "Demo Admin",
    label: "Admin",
    description: "Sieht alles: Rechteverwaltung, Statistik, Einstellungen.",
  },
];

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE?.trim() === "true";
}

export function findDemoPersona(email: string): DemoPersona | undefined {
  const normalized = email.trim().toLowerCase();
  return DEMO_PERSONAS.find((persona) => persona.email === normalized);
}
