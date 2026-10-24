import type { ComponentType, ReactNode } from "react";

import {
  ActivityIcon,
  BarChart3Icon,
  BookOpenTextIcon,
  CalendarCheckIcon,
  CalendarCogIcon,
  CalendarXIcon,
  ChefHatIcon,
  CameraIcon,
  CircleIcon,
  ClipboardListIcon,
  ClapperboardIcon,
  DramaIcon,
  FileStackIcon,
  GiftIcon,
  GraduationCapIcon,
  LayersIcon,
  LayoutGridIcon,
  ListChecksIcon,
  MailIcon,
  PaletteIcon,
  PiggyBankIcon,
  ReceiptIcon,
  RulerIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TicketIcon,
  UserCogIcon,
  UserRoundIcon,
  UsersRoundIcon,
  WarehouseIcon,
  WheatOffIcon,
} from "@/components/ui/action-icons";

export type MembersNavIconProps = { className?: string };
export type MembersNavIcon = ComponentType<MembersNavIconProps>;

export type MembersNavGroupId =
  "general" | "personal" | "production" | "workshop" | "admin" | "pages";

/** Bis zu so vielen Einträgen zeigt das Menü eine flache Liste ohne Gruppenüberschriften. */
export const MEMBERS_NAV_FLAT_MAX_ITEMS = 10;
export const MEMBERS_NAV_PRODUCTION_GROUP_ID: MembersNavGroupId = "production";

export interface MembersNavItem {
  href: string;
  label: string;
  icon?: MembersNavIcon;
  permissionKey?: string;
  /** Sichtbar auch mit einem dieser Rechte (z. B. Stück für „Ausstattung anfordern“). */
  alsoPermissionKeys?: readonly string[];
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
  /** Leer = Einträge ohne Überschrift ganz oben (immer offen). */
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
    label: "",
    items: [
      {
        href: "/mitglieder",
        label: "Start",
        permissionKey: "PRIVATE.DASHBOARD.OVERVIEW.VIEW",
        icon: LayoutGridIcon,
      },
      {
        href: "/mitglieder/meine-proben",
        label: "Meine Termine",
        permissionKey: "PRIVATE.REHEARSAL.OWN.VIEW",
        icon: CalendarCheckIcon,
      },
      {
        href: "/mitglieder/sperrliste",
        label: "Sperrliste",
        permissionKey: "PRIVATE.REHEARSAL.BLOCKLIST.VIEW",
        icon: CalendarXIcon,
      },
      {
        href: "/mitglieder/text",
        label: "Mein Text",
        permissionKey: "PRIVATE.PRODUCTION.SCRIPT.READ",
        icon: ScrollTextIcon,
      },
      {
        href: "/mitglieder/text/lernen",
        label: "Text lernen",
        permissionKey: "PRIVATE.PRODUCTION.SCRIPT.READ",
        icon: GraduationCapIcon,
      },
      {
        href: "/mitglieder/meine-gewerke",
        label: "Meine Teams",
        permissionKey: "PRIVATE.DEPARTMENT.OWN.VIEW",
        icon: UsersRoundIcon,
      },
    ],
  },
  {
    id: "personal",
    label: "Mein Bereich",
    items: [
      {
        href: "/mitglieder/profil",
        label: "Profil",
        permissionKey: "PRIVATE.PROFILE.OWN.VIEW",
        icon: UserRoundIcon,
      },
      {
        href: "/mitglieder/finanzen/auslagen",
        label: "Meine Auslagen",
        permissionKey: "PRIVATE.PROFILE.OWN.VIEW",
        icon: ReceiptIcon,
      },
      {
        href: "/mitglieder/freikarten",
        label: "Freikarten",
        permissionKey: "PRIVATE.PROFILE.OWN.VIEW",
        icon: GiftIcon,
      },
      {
        href: "/mitglieder/rezepte",
        label: "Rezepte",
        permissionKey: "PRIVATE.PROFILE.OWN.VIEW",
        icon: ChefHatIcon,
      },
    ],
  },
  {
    id: "production",
    label: "Produktion",
    items: [
      {
        href: "/mitglieder/produktionen",
        label: "Übersicht",
        permissionKey: "PRIVATE.PRODUCTION.SHOW.MANAGE",
        icon: ClapperboardIcon,
      },
      {
        href: "/mitglieder/produktionen/stueck",
        label: "Stück & Skript",
        permissionKey: "PRIVATE.PRODUCTION.SHOW.MANAGE",
        alsoPermissionKeys: ["PRIVATE.PRODUCTION.REQUIREMENT.CREATE"],
        icon: BookOpenTextIcon,
      },
      {
        href: "/mitglieder/terminplanung",
        label: "Terminplanung",
        permissionKey: "PRIVATE.REHEARSAL.PLANNING.MANAGE",
        icon: CalendarCogIcon,
      },
      {
        href: "/mitglieder/regie",
        label: "Regie",
        permissionKey: "PRIVATE.PRODUCTION.DIRECTION.DASHBOARD",
        icon: DramaIcon,
      },
      {
        href: "/mitglieder/produktionen/zuweisung",
        label: "Besetzung & Teams",
        permissionKey: "PRIVATE.PRODUCTION.SHOW.MANAGE",
        showForDepartmentLead: true,
        icon: ClipboardListIcon,
      },
      {
        href: "/mitglieder/produktionen/rueckmeldungen-auswertung",
        label: "Rückmeldungen",
        permissionKey: "PRIVATE.PRODUCTION.SHOW.MANAGE",
        icon: ListChecksIcon,
      },
      {
        href: "/mitglieder/karten",
        label: "Kartenverkauf",
        permissionKey: "PRIVATE.TICKETS.OFFICE",
        alsoPermissionKeys: ["PRIVATE.TICKETS.MANAGE", "PRIVATE.TICKETS.CHECKIN"],
        icon: TicketIcon,
      },
    ],
  },
  {
    id: "workshop",
    label: "Werkstatt",
    items: [
      {
        href: "/mitglieder/lager",
        label: "Lager",
        permissionKey: "PRIVATE.INVENTORY.USE",
        icon: WarehouseIcon,
      },
      {
        href: "/mitglieder/koerpermasse",
        label: "Körpermaße",
        permissionKey: "PRIVATE.PROFILE.MEASUREMENTS.MANAGE",
        icon: RulerIcon,
      },
      {
        href: "/mitglieder/blaupausen",
        label: "Blaupausen",
        permissionKey: "PRIVATE.DEPARTMENT.TEMPLATE.MANAGE",
        icon: FileStackIcon,
      },
      {
        href: "/mitglieder/verpflegung/zuordnung",
        label: "Allergie-Zuordnung",
        permissionKey: "PRIVATE.FOOD.TAXONOMY.MANAGE",
        icon: WheatOffIcon,
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
        href: "/mitglieder/finanzen",
        label: "Finanzen",
        permissionKey: "PRIVATE.FINANCE.VIEW",
        alsoPermissionKeys: ["PRIVATE.FINANCE.MANAGE"],
        icon: PiggyBankIcon,
      },
    ],
  },
  {
    id: "pages",
    label: "Website & System",
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
      {
        href: "/mitglieder/server-einstellungen",
        label: "E-Mail-Versand",
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
      {
        href: "/mitglieder/datenportal",
        label: "Datenportal",
        permissionKey: "PRIVATE.DATA.PORTAL.VIEW",
        icon: BarChart3Icon,
      },
    ],
  },
] satisfies readonly MembersNavGroup[];

/** Absicherung für Einträge ohne eigenes Symbol (kommt im Bestand nicht vor). */
export const defaultMembersNavIcon: MembersNavIcon = CircleIcon;
