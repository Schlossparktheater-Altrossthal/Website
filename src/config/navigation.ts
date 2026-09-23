export type NavigationItem = {
  label: string;
  href: string;
  description?: string;
};

export const primaryNavigation: NavigationItem[] = [
  {
    label: "Über uns",
    href: "/old/ueber-uns",
    description: "Lerne Ensemble, Geschichte und Werte des Sommertheaters kennen.",
  },
  {
    label: "Das Geheimnis",
    href: "/old/mystery",
    description: "Tauche in die Welt hinter dem mystischen Vorhang ein.",
  },
  {
    label: "Unsere Schulkatze",
    href: "/old/unsere-schulkatze",
    description: "Lerne Dieter kennen – Pausenbegleiter und Herz unserer Schule.",
  },
  {
    label: "Chronik",
    href: "/old/chronik",
    description: "Alle Meilensteine und Produktionen der vergangenen Jahre.",
  },
];

export const secondaryNavigation: NavigationItem[] = [
  {
    label: "Login",
    href: "/login",
  },
  {
    label: "Impressum",
    href: "/old/impressum",
  },
];
