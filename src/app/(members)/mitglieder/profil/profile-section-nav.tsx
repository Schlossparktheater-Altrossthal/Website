"use client";

import {
  CameraIcon,
  CreditCardIcon,
  HeartIcon,
  TheaterIcon,
  UserIcon,
  UtensilsIcon,
  type IconComponent,
} from "@/components/ui/action-icons";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { cn } from "@/lib/utils";

import {
  getProfileSectionHref,
  PROFILE_SECTION_GROUP_LABELS,
  PROFILE_SECTIONS,
  type ProfileSectionId,
} from "./profile-sections";

export type ProfileSectionStatus = {
  missing: boolean;
  summary: string;
};

const SECTION_ICONS: Record<ProfileSectionId, IconComponent> = {
  stammdaten: UserIcon,
  zahlungen: CreditCardIcon,
  ernaehrung: UtensilsIcon,
  freigaben: CameraIcon,
  interessen: HeartIcon,
  produktion: TheaterIcon,
};

type ProfileSectionNavProps = {
  activeSection: ProfileSectionId;
  status: Record<ProfileSectionId, ProfileSectionStatus>;
};

/**
 * Bereichsliste des Profils. Mobil die Startansicht (Tippen öffnet den Bereich), auf dem
 * Desktop die linke Navigation mit markiertem aktivem Bereich.
 */
export function ProfileSectionNav({ activeSection, status }: ProfileSectionNavProps) {
  const groups = (["person", "production"] as const).map((group) => ({
    group,
    sections: PROFILE_SECTIONS.filter((section) => section.group === group),
  }));

  return (
    <div className="space-y-4">
      {groups.map(({ group, sections }) => (
        <div key={group} className="space-y-1.5">
          <p className="px-1 text-xs font-medium text-muted-foreground">
            {PROFILE_SECTION_GROUP_LABELS[group]}
          </p>
          <div className="rounded-lg border border-border/60 bg-card p-1 shadow-sm lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <ListRowGroup className="lg:divide-y-0">
              {sections.map((section) => {
                const Icon = SECTION_ICONS[section.id];
                const sectionStatus = status[section.id];
                const active = section.id === activeSection;
                return (
                  <ListRow
                    key={section.id}
                    href={getProfileSectionHref(section.id)}
                    aria-current={active ? "page" : undefined}
                    className={cn(active && "lg:bg-muted lg:font-semibold")}
                    leading={
                      <span className="relative flex h-8 w-8 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
                        <Icon className="h-4 w-4" aria-hidden />
                        {sectionStatus.missing ? (
                          <span
                            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-warning"
                            aria-hidden
                          />
                        ) : null}
                      </span>
                    }
                    title={section.label}
                    description={
                      <span className={cn(sectionStatus.missing && "text-warning")}>
                        {sectionStatus.missing ? "Fehlt: " : null}
                        {sectionStatus.summary}
                      </span>
                    }
                    chevron
                  />
                );
              })}
            </ListRowGroup>
          </div>
        </div>
      ))}
    </div>
  );
}
