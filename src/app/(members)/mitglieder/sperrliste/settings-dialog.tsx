"use client";

import { Settings2Icon } from "@/components/ui/action-icons";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { SperrlisteSettingsChangePayload } from "./settings-manager";
import { BlocklistSettingsManager } from "./settings-manager";
import type { ClientSperrlisteSettings } from "@/lib/sperrliste-settings";

interface BlocklistSettingsDialogProps {
  settings: ClientSperrlisteSettings;
  defaultHolidaySourceUrl: string;
  defaultPublicHolidaySourceUrl: string;
  onSettingsChange?: (payload: SperrlisteSettingsChangePayload) => void;
}

export function BlocklistSettingsDialog({
  settings,
  defaultHolidaySourceUrl,
  defaultPublicHolidaySourceUrl,
  onSettingsChange,
}: BlocklistSettingsDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto w-full justify-center gap-2 rounded-full border border-transparent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground shadow-none hover:border-primary/20 hover:bg-primary/10 hover:text-foreground sm:w-auto sm:justify-start sm:text-sm"
        >
          <Settings2Icon className="h-4 w-4" aria-hidden />
          <span className="sm:hidden">Einstellungen</span>
          <span className="hidden sm:inline">Sperrlisten-Einstellungen</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-hidden border-0 bg-transparent p-0 sm:max-w-5xl">
        <div className="max-h-[90vh] overflow-y-auto">
          <BlocklistSettingsManager
            settings={settings}
            defaultHolidaySourceUrl={defaultHolidaySourceUrl}
            defaultPublicHolidaySourceUrl={defaultPublicHolidaySourceUrl}
            onSettingsChange={(payload) => {
              onSettingsChange?.(payload);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
