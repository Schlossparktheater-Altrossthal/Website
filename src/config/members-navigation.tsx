import React from "react";
import type { ComponentType, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type MembersNavIconProps = { className?: string };
export type MembersNavIcon = ComponentType<MembersNavIconProps>;

export type MembersNavGroupId =
  | "general"
  | "assignments"
  | "final-week"
  | "production"
  | "finance"
  | "inventory"
  | "admin";

export const MEMBERS_NAV_ASSIGNMENTS_GROUP_ID: MembersNavGroupId = "assignments";
export const MEMBERS_NAV_PRODUCTION_GROUP_ID: MembersNavGroupId = "production";

export interface MembersNavItem {
  href: string;
  label: string;
  icon?: MembersNavIcon;
  permissionKey?: string;
  ariaLabel?: string;
  badge?: ReactNode;
}

export interface MembersNavGroup {
  id: MembersNavGroupId;
  label: string;
  items: readonly MembersNavItem[];
}

function createMembersNavIcon(children: ReactNode): MembersNavIcon {
  const Icon: MembersNavIcon = ({ className }) => (
    <svg
      className={cn("h-4 w-4", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
  Icon.displayName = "MembersNavIcon";
  return Icon;
}

const DashboardIcon = createMembersNavIcon(
  <>
    <path d="M3 13h8V3H3z" />
    <path d="M13 21h8v-8h-8z" />
    <path d="M13 3v8h8V3z" />
    <path d="M3 21h8v-4H3z" />
  </>,
);

const ProfileIcon = createMembersNavIcon(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6" />
  </>,
);

const ArchiveIcon = createMembersNavIcon(
  <>
    <path d="M3 8a2 2 0 0 1 2-2h2l1.2-2h5.6L15 6h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <circle cx="12" cy="12" r="3" />
    <path d="M7 8h2" />
  </>,
);

const FileLibraryIcon = createMembersNavIcon(
  <>
    <path d="M4 6a2 2 0 0 1 2-2h5l3 3h4a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
    <path d="M11 4v4h5" />
    <path d="M8 13h8" />
    <path d="M8 17h5" />
  </>,
);

const IssuesIcon = createMembersNavIcon(
  <>
    <path d="M21 15a2 2 0 0 1-2 2H9l-4 4v-4H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
    <path d="M9 7h6" />
    <path d="M9 11h6" />
  </>,
);

const ScannerIcon = createMembersNavIcon(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 9h10" />
    <path d="M5 13h14" />
    <path d="M10 17h6" />
  </>,
);

const InventoryStickersIcon = createMembersNavIcon(
  <>
    <path d="M4 5a2 2 0 0 1 2-2h6l8 8-8 8H6a2 2 0 0 1-2-2z" />
    <path d="M9 7h.01" />
    <path d="M9 11h4" />
    <path d="M9 15h4" />
  </>,
);

const TechInventoryIcon = createMembersNavIcon(
  <>
    <path d="M3 8.5 12 4l9 4.5" />
    <path d="M5 11h14v8H5z" />
    <path d="M9 15h6" />
    <path d="M12 12v6" />
  </>,
);

const CostumeInventoryIcon = createMembersNavIcon(
  <>
    <path d="M12 4a2 2 0 0 1 2 2c0 1.105-.895 2-2 2s-2-.895-2-2" />
    <path d="M8 8 6 20h12L16 8" />
    <path d="M10 16h4" />
  </>,
);

const RehearsalsIcon = createMembersNavIcon(
  <>
    <path d="M4 6a2 2 0 0 1 2-2h6" />
    <path d="M20 10v8a2 2 0 0 1-2 2h-6" />
    <circle cx="9" cy="10" r="3" />
    <path d="M4 20c0-2.761 2.239-5 5-5" />
    <path d="m15 5 2 2 4-4" />
    <path d="M14 9h6" />
  </>,
);

const DepartmentsIcon = createMembersNavIcon(
  <>
    <rect x="5" y="4" width="14" height="16" rx="2" />
    <path d="M9 2h6" />
    <path d="M12 2v2" />
    <path d="M8 10h8" />
    <path d="M8 14h8" />
    <path d="M8 18h5" />
    <path d="m6 15 1.8 1.8L10 14" />
  </>,
);

const DepartmentTodosIcon = createMembersNavIcon(
  <>
    <path d="M4 6l1.5 1.5L7 6" />
    <path d="M4 12l1.5 1.5L7 12" />
    <path d="M4 18l1.5 1.5L7 18" />
    <path d="M9 6h11" />
    <path d="M9 12h11" />
    <path d="M9 18h11" />
  </>,
);

const BodyMeasurementsIcon = createMembersNavIcon(
  <>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M6 10h.01" />
    <path d="M9 10h.01" />
    <path d="M12 10h.01" />
    <path d="M15 10h.01" />
    <path d="M18 10h.01" />
    <path d="M6 14h6" />
    <path d="M6 18v2" />
    <path d="M18 18v2" />
  </>,
);

const BlacklistIcon = createMembersNavIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m5 5 14 14" />
  </>,
);

const RehearsalPlanningIcon = createMembersNavIcon(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4" />
    <path d="M8 2v4" />
    <path d="M3 10h18" />
  </>,
);

const DutyRosterIcon = createMembersNavIcon(
  <>
    <rect x="4" y="5" width="16" height="16" rx="2" />
    <path d="M9 3v4" />
    <path d="M15 3v4" />
    <path d="M4 11h16" />
    <path d="m9 16 2 2 4-4" />
  </>,
);

const MealPlanIcon = createMembersNavIcon(
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 2v4" />
    <path d="M15 2v4" />
    <path d="M3 10h18" />
    <path d="M7 14h6" />
    <path d="M7 18h6" />
    <path d="m17 14 2 2 2-2" />
    <path d="M17 18h4" />
  </>,
);

const CateringIcon = createMembersNavIcon(
  <>
    <path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8" />
    <path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7" />
    <path d="m2.1 21.8 6.4-6.3" />
    <path d="m19 5-7 7" />
  </>,
);

const ShoppingListIcon = createMembersNavIcon(
  <>
    <path d="M6 4h12a2 2 0 0 1 2 2v14H4V6a2 2 0 0 1 2-2Z" />
    <path d="M9 2v4" />
    <path d="M15 2v4" />
    <path d="m9 11 2 2 4-4" />
    <path d="M9 17h6" />
  </>,
);

const ProductionIcon = createMembersNavIcon(
  <>
    <path d="M3 4h18v4H3z" />
    <path d="M5 8v12h14V8" />
    <path d="M9 12h6" />
    <path d="M9 16h6" />
  </>,
);

const DepartmentsOverviewIcon = createMembersNavIcon(
  <>
    <circle cx="7" cy="7" r="2.5" />
    <circle cx="17" cy="7" r="2.5" />
    <circle cx="12" cy="17" r="2.5" />
    <path d="M9.5 7h5" />
    <path d="M9.4 8.6 12 12" />
    <path d="M14.6 8.6 12 12" />
    <path d="M12 14.5V12" />
  </>,
);

const CastIcon = createMembersNavIcon(
  <>
    <circle cx="9" cy="8" r="3" />
    <path d="M4 20c0-3 2.239-5.5 5-5.5S14 17 14 20" />
    <path d="M17 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
    <path d="M20.5 20c0-2.485-2.015-4.5-4.5-4.5" />
  </>,
);

const ScenesIcon = createMembersNavIcon(
  <>
    <path d="M3 9h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M3 9l2.5-5h5L8 9" />
    <path d="M8 9l2.5-5h5L13 9" />
    <path d="M3 13h18" />
  </>,
);

const MembersAdminIcon = createMembersNavIcon(
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="m20 8 1 1 2-2" />
  </>,
);

const PermissionsIcon = createMembersNavIcon(
  <path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z" />
);

const PhotoConsentIcon = createMembersNavIcon(
  <>
    <path d="M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l2-3h4l2 3h3a2 2 0 0 1 2 2Z" />
    <circle cx="12" cy="14" r="3" />
  </>,
);

const WebsiteIcon = createMembersNavIcon(
  <>
    <path d="M12 22c4.97 0 9-3.6 9-8a7 7 0 0 0-7-7 4 4 0 0 1-4-4 9 9 0 0 0-9 9c0 4.4 4.03 8 9 8Z" />
    <circle cx="6.5" cy="11.5" r="1.5" />
    <circle cx="9.5" cy="7.5" r="1.5" />
    <circle cx="14.5" cy="7.5" r="1.5" />
    <circle cx="17.5" cy="11.5" r="1.5" />
  </>,
);

const ServerAnalyticsIcon = createMembersNavIcon(
  <>
    <path d="M4 20h16" />
    <path d="M6 16l4-6 3 4 4-7 3 5" />
  </>,
);

const FinanceDashboardIcon = createMembersNavIcon(
  <>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M7 10h10" />
    <path d="M7 14h6" />
    <circle cx="9" cy="10" r="0.5" fill="currentColor" />
    <circle cx="15" cy="14" r="0.5" fill="currentColor" />
  </>,
);

const FinanceBookingsIcon = createMembersNavIcon(
  <>
    <path d="M4 6h16v4H4z" />
    <path d="M7 10v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-8" />
    <path d="M9 14h6" />
    <path d="M9 18h4" />
  </>,
);

const FinanceBudgetsIcon = createMembersNavIcon(
  <>
    <path d="M4 19h16" />
    <path d="M7 19v-7" />
    <path d="M12 19v-11" />
    <path d="M17 19v-5" />
    <path d="M5 8h14l-2-3H7z" />
  </>,
);

const FinanceExportIcon = createMembersNavIcon(
  <>
    <path d="M12 3v12" />
    <path d="m8 11 4 4 4-4" />
    <path d="M4 19h16" />
  </>,
);

const DefaultIcon = createMembersNavIcon(<circle cx="12" cy="12" r="2" />);

export const membersAssignmentsTodoItem: MembersNavItem = {
  href: "/mitglieder/meine-gewerke/todos",
  label: "Meine Gewerke-Aufgaben",
  permissionKey: "mitglieder.meine-gewerke",
  icon: DepartmentTodosIcon,
};

export const membersNavigation = [
  {
    id: "general",
    label: "Allgemein",
    items: [
      {
        href: "/mitglieder",
        label: "Dashboard",
        permissionKey: "mitglieder.dashboard",
        icon: DashboardIcon,
      },
      {
        href: "/mitglieder/profil",
        label: "Profil",
        permissionKey: "mitglieder.profil",
        icon: ProfileIcon,
      },
      {
        href: "/mitglieder/archiv-und-bilder",
        label: "Archiv und Bilder",
        permissionKey: "mitglieder.galerie",
        icon: ArchiveIcon,
      },
      {
        href: "/mitglieder/dateisystem",
        label: "Dateisystem",
        permissionKey: "mitglieder.dateisystem",
        icon: FileLibraryIcon,
      },
      {
        href: "/mitglieder/sperrliste",
        label: "Sperrliste",
        permissionKey: "mitglieder.sperrliste",
        icon: BlacklistIcon,
      },
      {
        href: "/mitglieder/scan",
        label: "Scanner",
        permissionKey: "mitglieder.scan",
        icon: ScannerIcon,
      },
      {
        href: "/mitglieder/inventar-aufkleber",
        label: "Inventaraufkleber",
        permissionKey: "mitglieder.inventaraufkleber",
        icon: InventoryStickersIcon,
      },
      {
        href: "/mitglieder/issues",
        label: "Feedback & Support",
        permissionKey: "mitglieder.issues",
        icon: IssuesIcon,
      },
    ],
  },
  {
    id: "inventory",
    label: "Lagerverwaltung",
    items: [
      {
        href: "/mitglieder/lagerverwaltung/technik",
        label: "Technik-Lager",
        permissionKey: "mitglieder.lager.technik",
        icon: TechInventoryIcon,
      },
      {
        href: "/mitglieder/lagerverwaltung/kostueme",
        label: "Kostüm-Lager",
        permissionKey: "mitglieder.lager.kostueme",
        icon: CostumeInventoryIcon,
      },
    ],
  },
  {
    id: "assignments",
    label: "Proben & Gewerke",
    items: [
      {
        href: "/mitglieder/meine-proben",
        label: "Meine Proben",
        permissionKey: "mitglieder.meine-proben",
        icon: RehearsalsIcon,
      },
      {
        href: "/mitglieder/meine-gewerke",
        label: "Meine Gewerke",
        permissionKey: "mitglieder.meine-gewerke",
        icon: DepartmentsIcon,
      },
      {
        href: "/mitglieder/koerpermasse",
        label: "Körpermaße",
        permissionKey: "mitglieder.koerpermasse",
        icon: BodyMeasurementsIcon,
      },
      {
        href: "/mitglieder/probenplanung",
        label: "Probenplanung",
        permissionKey: "mitglieder.probenplanung",
        icon: RehearsalPlanningIcon,
      },
    ],
  },
  {
    id: "final-week",
    label: "Endproben Woche",
    items: [
      {
        href: "/mitglieder/endproben-woche/dienstplan",
        label: "Dienstplan",
        permissionKey: "mitglieder.endprobenwoche",
        icon: DutyRosterIcon,
      },
      {
        href: "/mitglieder/endproben-woche/essenplanung",
        label: "Essensplanung",
        permissionKey: "mitglieder.essenplanung",
        icon: CateringIcon,
      },
      {
        href: "/mitglieder/endproben-woche/menueplan",
        label: "Menüplan",
        permissionKey: "mitglieder.essenplanung",
        icon: MealPlanIcon,
      },
      {
        href: "/mitglieder/endproben-woche/einkaufsliste",
        label: "Einkaufsliste",
        permissionKey: "mitglieder.essenplanung",
        icon: ShoppingListIcon,
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
        permissionKey: "mitglieder.produktionen",
        icon: ProductionIcon,
      },
      {
        href: "/mitglieder/produktionen/gewerke",
        label: "Gewerke & Teams",
        permissionKey: "mitglieder.produktionen",
        icon: DepartmentsOverviewIcon,
      },
      {
        href: "/mitglieder/produktionen/besetzung",
        label: "Rollen & Besetzung",
        permissionKey: "mitglieder.produktionen",
        icon: CastIcon,
      },
      {
        href: "/mitglieder/produktionen/szenen",
        label: "Szenen & Breakdowns",
        permissionKey: "mitglieder.produktionen",
        icon: ScenesIcon,
      },
    ],
  },
  {
    id: "finance",
    label: "Finanzen",
    items: [
      {
        href: "/mitglieder/finanzen",
        label: "Finanz-Dashboard",
        permissionKey: "mitglieder.finanzen",
        icon: FinanceDashboardIcon,
      },
      {
        href: "/mitglieder/finanzen/buchungen",
        label: "Buchungen",
        permissionKey: "mitglieder.finanzen",
        icon: FinanceBookingsIcon,
      },
      {
        href: "/mitglieder/finanzen/budgets",
        label: "Budgets",
        permissionKey: "mitglieder.finanzen",
        icon: FinanceBudgetsIcon,
      },
      {
        href: "/mitglieder/finanzen/export",
        label: "Exporte",
        permissionKey: "mitglieder.finanzen.export",
        icon: FinanceExportIcon,
      },
    ],
  },
  {
    id: "admin",
    label: "Verwaltung",
    items: [
      {
        href: "/mitglieder/mitgliederverwaltung",
        label: "Mitgliederverwaltung",
        permissionKey: "mitglieder.rollenverwaltung",
        icon: MembersAdminIcon,
      },
      {
        href: "/mitglieder/onboarding-analytics",
        label: "Onboarding Analytics",
        permissionKey: "mitglieder.onboarding.analytics",
        icon: DefaultIcon,
      },
      {
        href: "/mitglieder/server-analytics",
        label: "Server-Statistiken",
        permissionKey: "mitglieder.server.analytics",
        icon: ServerAnalyticsIcon,
      },
      {
        href: "/mitglieder/rechte",
        label: "Rechteverwaltung",
        permissionKey: "mitglieder.rechte",
        icon: PermissionsIcon,
      },
      {
        href: "/mitglieder/fotoerlaubnisse",
        label: "Fotoerlaubnisse",
        permissionKey: "mitglieder.fotoerlaubnisse",
        icon: PhotoConsentIcon,
      },
      {
        href: "/mitglieder/website",
        label: "Website & Theme",
        permissionKey: "mitglieder.website.settings",
        icon: WebsiteIcon,
      },
    ],
  },
] satisfies readonly MembersNavGroup[];

export const defaultMembersNavIcon = DefaultIcon;
