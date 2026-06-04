/**
 * Project-wide responsive breakpoint patterns.
 *
 * Tailwind default breakpoints are used throughout the app. This file documents
 * the shared responsive navigation decisions so UI components can reference a
 * single typed source of truth instead of hard-coding intent in each feature.
 */

type TailwindBreakpointName = "sm" | "md" | "lg" | "xl" | "2xl";

type BreakpointPattern = {
  /** Tailwind breakpoint name when the switch maps directly to Tailwind. */
  name: TailwindBreakpointName;
  /** Pixel value where the desktop variant starts. */
  minWidthPx: number;
  /** Human-readable mobile behavior below the breakpoint. */
  mobile: string;
  /** Human-readable desktop behavior at and above the breakpoint. */
  desktop: string;
};

type MediaQueryPattern = {
  /** CSS media query used by the responsive component. */
  mediaQuery: string;
  /** Largest pixel width that still uses the mobile variant. */
  maxMobileWidthPx: number;
  /** Pixel value where the desktop variant starts. */
  minDesktopWidthPx: number;
  /** Human-readable mobile behavior below the desktop breakpoint. */
  mobile: string;
  /** Human-readable desktop behavior at and above the desktop breakpoint. */
  desktop: string;
};

type ResponsiveNavPattern = {
  /** UI component used below the breakpoint. */
  mobileComponent: string;
  /** Import path for the mobile component. */
  mobileImportPath: string;
  /** UI component used at and above the breakpoint. */
  desktopComponent: string;
  /** Import path for the desktop component. */
  desktopImportPath: string;
  /** Shared breakpoint pattern for this context. */
  breakpoint: BreakpointPattern | MediaQueryPattern;
};

/**
 * Tabs switch at Tailwind's default `sm` breakpoint.
 * Below 640px, tab lists render as a full-width shadcn Select dropdown.
 * At 640px and above, tab lists render as pill tabs.
 */
export const TAB_BREAKPOINT = {
  name: "sm",
  minWidthPx: 640,
  mobile: "Select dropdown",
  desktop: "pill tabs",
} as const satisfies BreakpointPattern;

/**
 * Header navigation switches at Tailwind's default `md` breakpoint.
 * Below 768px, the public header navigation renders in a Sheet.
 * At 768px and above, the public header navigation renders horizontally.
 */
export const HEADER_BREAKPOINT = {
  name: "md",
  minWidthPx: 768,
  mobile: "Sheet navigation",
  desktop: "horizontal navigation",
} as const satisfies BreakpointPattern;

/**
 * Members sidebar uses an explicit media query aligned with Tailwind's `lg`
 * boundary. Up to 1023px, the sidebar renders in a Sheet. At 1024px and above,
 * it renders as a fixed sidebar.
 */
export const SIDEBAR_BREAKPOINT = {
  mediaQuery: "(max-width: 1023px)",
  maxMobileWidthPx: 1023,
  minDesktopWidthPx: 1024,
  mobile: "Sheet sidebar",
  desktop: "fixed sidebar",
} as const satisfies MediaQueryPattern;

/**
 * Shared responsive navigation patterns for tab, header, and sidebar contexts.
 * Use this object when documenting or implementing project-wide responsive
 * navigation behavior.
 */
export const RESPONSIVE_NAV_PATTERN = {
  tabs: {
    mobileComponent: "Select",
    mobileImportPath: "@/components/ui/select",
    desktopComponent: "TabsList / TabsTrigger pill tabs",
    desktopImportPath: "@/components/ui/tabs",
    breakpoint: TAB_BREAKPOINT,
  },
  header: {
    mobileComponent: "Sheet",
    mobileImportPath: "@/components/ui/sheet",
    desktopComponent: "horizontal Link navigation",
    desktopImportPath: "next/link",
    breakpoint: HEADER_BREAKPOINT,
  },
  sidebar: {
    mobileComponent: "Sheet",
    mobileImportPath: "@/components/ui/sheet",
    desktopComponent: "Sidebar",
    desktopImportPath: "@/components/ui/sidebar",
    breakpoint: SIDEBAR_BREAKPOINT,
  },
} as const satisfies Record<string, ResponsiveNavPattern>;
