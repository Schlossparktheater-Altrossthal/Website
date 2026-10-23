"use client";

import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  EditIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/ui/action-icons";
import { ThemePreviewCard } from "@/components/theme/theme-preview-card";
import { ActionDropdownMenu } from "@/components/ui/action-dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { ClientWebsiteThemeSummary } from "@/lib/website-settings";

export type ThemeGalleryActions = {
  onSelect: (id: string) => void;
  onActivate: (id: string) => void;
  onToggleMemberSelectable: (id: string, value: boolean) => void;
  onDuplicate: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
};

/** Alle Themes als Karten; Antippen öffnet das Theme im Editor, „⋯“ die übrigen Aktionen. */
export function ThemeGallery({
  themes,
  activeThemeId,
  selectedThemeId,
  actions,
}: {
  themes: ClientWebsiteThemeSummary[];
  activeThemeId: string;
  selectedThemeId: string;
  actions: ThemeGalleryActions;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {themes.map((theme) => {
        const isActive = theme.id === activeThemeId;
        return (
          <ThemePreviewCard
            key={theme.id}
            name={theme.name}
            swatches={theme.swatches}
            radius={theme.radius}
            selected={theme.id === selectedThemeId}
            selectLabel={`${theme.name} bearbeiten`}
            onSelect={() => actions.onSelect(theme.id)}
            badges={
              <>
                {isActive ? (
                  <Badge variant="success" size="sm">
                    Aktiv
                  </Badge>
                ) : null}
                {theme.memberSelectable ? (
                  <Badge variant="info" size="sm">
                    Wählbar
                  </Badge>
                ) : null}
                {theme.isPreset ? (
                  <Badge variant="muted" size="sm">
                    Vorlage
                  </Badge>
                ) : null}
              </>
            }
            actions={
              <ActionDropdownMenu
                label={`Aktionen für ${theme.name}`}
                className="size-11 shrink-0 border-transparent bg-transparent shadow-none sm:size-9"
                items={[
                  {
                    label: isActive ? "Ist für alle aktiv" : "Für alle aktivieren",
                    icon: <CheckIcon />,
                    disabled: isActive,
                    onSelect: () => actions.onActivate(theme.id),
                  },
                  {
                    label: theme.memberSelectable
                      ? "Für Mitglieder nicht mehr wählbar"
                      : "Für Mitglieder wählbar machen",
                    icon: <UsersIcon />,
                    onSelect: () =>
                      actions.onToggleMemberSelectable(theme.id, !theme.memberSelectable),
                  },
                  {
                    label: theme.isPreset ? "Ansehen" : "Bearbeiten",
                    icon: <EditIcon />,
                    onSelect: () => actions.onSelect(theme.id),
                  },
                  {
                    label: "Duplizieren",
                    icon: <CopyIcon />,
                    onSelect: () => actions.onDuplicate(theme.id),
                  },
                  {
                    label: "Exportieren",
                    icon: <DownloadIcon />,
                    onSelect: () => actions.onExport(theme.id),
                  },
                  ...(theme.isPreset
                    ? []
                    : [
                        {
                          label: "Löschen",
                          icon: <TrashIcon />,
                          variant: "destructive" as const,
                          disabled: isActive,
                          onSelect: () => actions.onDelete(theme.id),
                        },
                      ]),
                ]}
              />
            }
          />
        );
      })}
    </div>
  );
}
