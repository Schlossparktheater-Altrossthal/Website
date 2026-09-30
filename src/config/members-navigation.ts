import type { ComponentType, ReactNode } from "react";

import {
  ActivityIcon,
  BarChart3Icon,
  BookOpenTextIcon,
  CalendarCheckIcon,
  CalendarCogIcon,
  CalendarXIcon,
  CameraIcon,
  CircleIcon,
  ClipboardListIcon,
  ClapperboardIcon,
  LayersIcon,
  LayoutGridIcon,
  ListChecksIcon,
  MailIcon,
  PaletteIcon,
  RulerIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserCogIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from "@/components/ui/action-icons";

export type MembersNavIconProps = { className?: string };
export type MembersNavIcon = ComponentType<MembersNavIconProps>;

export type MembersNavGroupId = "general" | "assignments" | "production" | "admin" | "pages";

export const MEMBERS_NAV_ASSIGNMENTS_GROUP_ID: MembersNavGroupId = "assignments";
export const MEMBERS_NAV_PRODUCTION_GROUP_ID: MembersNavGroupId = "production";

export interface MembersNavItem {
  href: string;
  label: string;
  icon?: MembersNavIcon;
  permissionKey?: string;
  requiresBoardRole?: boolean;
  requiresDepartmentLead?: boolean;
  /** Zusätzlich zur Berechtigung für Gewerk-Leitungen sichtbar (z. B. „Teams & Zuweisung“). */
  showForDepartmentLead?: boolean;
  ariaLabel?: string;
  badge?: ReactNode;
}

export interface MembersNavSubgroup {
  id: string;
  label: string;
  items: readonly MembersNavItem[];
}

export interface MembersNavGroup {
  id: MembersNavGroupId;
  label: string;
  items: readonly MembersNavItem[];
  subgroups?: readonly MembersNavSubgroup[];
}

/**
 * Seiten-Icons (docs/Plan/seiten-icons-plan.md): Jede Seite hat genau ein Symbol, und jede
 * Route verwendet es überall gleich. Alle Symbole stammen aus `@/components/ui/action-icons`.
 */
export const membersNavigation = [
  {
    id: "general",
    label: "Allgemeines",
    items: [
      {
        href: "/mitglieder",
        label: "Dashboard",
        permissionKey: "PRIVATE.DASHBOARD.OVERVIEW.VIEW",
        icon: LayoutGridIcon,
      },
      {
        href: "/mitglieder/profil",
        label: "Profil",
        permissionKey: "PRIVATE.PROFILE.OWN.VIEW",
        icon: UserRoundIcon,
      },
      {
        href: "/mitglieder/sperrliste",
        label: "Sperrliste",
        permissionKey: "PRIVATE.REHEARSAL.BLOCKLIST.VIEW",
        icon: CalendarXIcon,
      },
      {
        href: "/mitglieder/meine-proben",
        label: "Meine Termine",
        permissionKey: "PRIVATE.REHEARSAL.OWN.VIEW",
        icon: CalendarCheckIcon,
      },
    ],
  },
  {
    id: "production",
    label: "Proben",
    items: [
      {
        href: "/mitglieder/produktionen",
        label: "Überblick",
        permissionKey: "PRIVATE.PRODUCTION.SHOW.MANAGE",
        icon: ClapperboardIcon,
      },
      {
        href: "/mitglieder/terminplanung",
        label: "Terminplanung",
        permissionKey: "PRIVATE.REHEARSAL.PLANNING.MANAGE",
        icon: CalendarCogIcon,
      },
      {
        href: "/mitglieder/produktionen/stueck",
        label: "Stück",
        permissionKey: "PRIVATE.PRODUCTION.SHOW.MANAGE",
        icon: BookOpenTextIcon,
      },
      {
        href: "/mitglieder/produktionen/rueckmeldungen-auswertung",
        label: "Rückmeldungen & Auswertung",
        permissionKey: "PRIVATE.PRODUCTION.SHOW.MANAGE",
        icon: ListChecksIcon,
      },
    ],
  },
  {
    id: "assignments",
    label: "Gewerke",
    items: [
      {
        href: "/mitglieder/produktionen/zuweisung",
        label: "Teams & Zuweisung",
        permissionKey: "PRIVATE.PRODUCTION.SHOW.MANAGE",
        showForDepartmentLead: true,
        icon: ClipboardListIcon,
      },
      {
        href: "/mitglieder/meine-gewerke",
        label: "Meine Teams",
        permissionKey: "PRIVATE.DEPARTMENT.OWN.VIEW",
        icon: UsersRoundIcon,
      },
      {
        href: "/mitglieder/koerpermasse",
        label: "Körpermaße",
        permissionKey: "PRIVATE.PROFILE.MEASUREMENTS.MANAGE",
        icon: RulerIcon,
      },
    ],
  },
  {
    id: "pages",
    label: "Pages",
    items: [
      {
        href: "/mitglieder/website",
        label: "Website & Theme",
        permissionKey: "PRIVATE.ADMIN.PAGES.MANAGE",
        icon: PaletteIcon,
      },
      {
        href: "/mitglieder/pages/seitensteuerung",
        label: "Seitensteuerung",
        permissionKey: "PRIVATE.ADMIN.PAGES.MANAGE",
        icon: LayersIcon,
      },
    ],
  },
  {
    id: "admin",
    label: "Verwaltung",
    items: [
      {
        href: "/mitglieder/mitgliederverwaltung",
        label: "Mitglieder",
        permissionKey: "PRIVATE.ADMIN.MEMBERS.MANAGE",
        icon: UserCogIcon,
      },
      {
        href: "/mitglieder/rechte",
        label: "Rollen & Rechte",
        permissionKey: "PRIVATE.ADMIN.PERMISSIONS.MANAGE",
        icon: ShieldCheckIcon,
      },
      {
        href: "/mitglieder/fotoerlaubnisse",
        label: "Fotoerlaubnisse",
        permissionKey: "PRIVATE.PHOTOCONSENT.VIEW",
        icon: CameraIcon,
      },
      {
        href: "/mitglieder/datenportal",
        label: "Datenportal",
        permissionKey: "PRIVATE.DATA.PORTAL.VIEW",
        icon: BarChart3Icon,
      },
      {
        href: "/mitglieder/server-einstellungen",
        label: "E-Mail Server Einstellungen",
        permissionKey: "PRIVATE.ADMIN.SERVER.SETTINGS",
        icon: MailIcon,
      },
      {
        href: "/mitglieder/server-analytics",
        label: "Server-Statistiken",
        permissionKey: "PRIVATE.ADMIN.SERVER.ANALYTICS",
        icon: ActivityIcon,
      },
      {
        href: "/mitglieder/onboarding",
        label: "Onboarding-Statistik",
        permissionKey: "PRIVATE.ADMIN.ONBOARDING.ANALYTICS",
        icon: SparklesIcon,
      },
    ],
  },
] satisfies readonly MembersNavGroup[];

/** Absicherung für Einträge ohne eigenes Symbol (kommt im Bestand nicht vor). */
export const defaultMembersNavIcon: MembersNavIcon = CircleIcon;
