import type { JSX } from "react";
import type { LucideIcon } from "lucide-react";

export type NavigationItemTone =
  | "default"
  | "muted"
  | "primary"
  | "success"
  | "info"
  | "warning"
  | "destructive";

export type NavigationBadgeVariant =
  | "default"
  | "secondary"
  | "accent"
  | "muted"
  | "success"
  | "warning"
  | "info"
  | "destructive"
  | "outline"
  | "ghost";

export type NavigationBadgeSize = "sm" | "md" | "lg";

export type NavigationItemBadge = {
  label: string;
  variant?: NavigationBadgeVariant;
  size?: NavigationBadgeSize;
};

export type NavigationIconComponent =
  | LucideIcon
  | ((props: { className?: string }) => JSX.Element);

export type NavigationItem = {
  label: string;
  href: string;
  description?: string;
  icon?: NavigationIconComponent;
  activeIcon?: NavigationIconComponent;
  tone?: NavigationItemTone;
  badge?: NavigationItemBadge;
};

import {
  BookMarked,
  Cat,
  History,
  LogIn,
  Mail,
  ScrollText,
  Sparkles,
  Users2,
} from "lucide-react";

export const primaryNavigation: NavigationItem[] = [
  {
    label: "Über uns",
    href: "/ueber-uns",
    description: "Lerne Ensemble, Geschichte und Werte des Sommertheaters kennen.",
    icon: Users2,
    activeIcon: BookMarked,
    tone: "primary",
  },
  {
    label: "Das Geheimnis",
    href: "/mystery",
    description: "Tauche in die Welt hinter dem mystischen Vorhang ein.",
    icon: Sparkles,
    tone: "info",
    badge: {
      label: "Neu",
      variant: "info",
      size: "sm",
    },
  },
  {
    label: "Unsere Schulkatze",
    href: "/unsere-schulkatze",
    description: "Lerne Minna kennen – Pausenbegleiterin und Herz unserer Schule.",
    icon: Cat,
    tone: "success",
  },
  {
    label: "Chronik",
    href: "/chronik",
    description: "Alle Meilensteine und Produktionen der vergangenen Jahre.",
    icon: History,
    tone: "muted",
  },
];

export const secondaryNavigation: NavigationItem[] = [
  {
    label: "Login",
    href: "/login",
    icon: LogIn,
    tone: "primary",
  },
  {
    label: "Newsletter",
    href: "/onboarding",
    icon: Mail,
    badge: {
      label: "Beliebt",
      variant: "accent",
      size: "sm",
    },
  },
  {
    label: "Impressum",
    href: "/impressum",
    icon: ScrollText,
    tone: "muted",
  },
];

export const ctaNavigation = {
  label: "Newsletter abonnieren",
  href: "/onboarding",
};
