export type NavigationItem = {
  label: string;
  href: string;
  description?: string;
};

export const primaryNavigation: NavigationItem[] = [
  {
    label: "Über uns",
    href: "/ueber-uns",
    description: "Lerne Ensemble, Geschichte und Werte des Sommertheaters kennen.",
  },
  {
    label: "Das Geheimnis",
    href: "/mystery",
    description: "Tauche in die Welt hinter dem mystischen Vorhang ein.",
  },
  {
    label: "Archiv und Bilder",
    href: "/galerie",
    description: "Alle Infos zum geschützten Medienarchiv mit Fotos und Videos vergangener Jahre.",
  },
  {
    label: "Unsere Schulkatze",
    href: "/unsere-schulkatze",
    description: "Lerne Minna kennen – Pausenbegleiterin und Herz unserer Schule.",
  },
  {
    label: "Chronik",
    href: "/chronik",
    description: "Alle Meilensteine und Produktionen der vergangenen Jahre.",
  },
];

export const secondaryNavigation: NavigationItem[] = [
  {
    label: "Login",
    href: "/login",
  },
  {
    label: "Newsletter",
    href: "/onboarding",
  },
  {
    label: "Impressum",
    href: "/impressum",
  },
];

export const ctaNavigation = {
  label: "Newsletter abonnieren",
  href: "/onboarding",
};
