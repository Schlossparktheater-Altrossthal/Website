"use client";

import { useState } from "react";

import { Settings2Icon } from "@/components/ui/action-icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import type { ClientSperrlisteSettings } from "@/lib/sperrliste-settings";

import { BlocklistSettingsManager, type SperrlisteSettingsChangePayload } from "./settings-manager";

interface BlocklistSettingsDialogProps {
  settings: ClientSperrlisteSettings;
  defaultHolidaySourceUrl: string;
  defaultPublicHolidaySourceUrl: string;
  onSettingsChange?: (payload: SperrlisteSettingsChangePayload) => void;
}

const TITLE = "Sperrlisten-Einstellungen";
const DESCRIPTION = "Kerntage, Sperrfrist sowie Ferien und Feiertage.";

export function BlocklistSettingsDialog(props: BlocklistSettingsDialogProps) {
  const [open, setOpen] = useState(false);

  const trigger = (
    <Button variant="outline" size="sm" aria-label={TITLE} onClick={() => setOpen(true)}>
      <Settings2Icon className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Einstellungen</span>
    </Button>
  );
  const manager = <BlocklistSettingsManager {...props} onSaved={() => setOpen(false)} />;

  return (
    <>
      {trigger}
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={TITLE}
        description={DESCRIPTION}
        className="h-[90dvh] sm:h-[85dvh] sm:max-w-xl"
      >
        {manager}
      </BottomSheet>
    </>
  );
}
