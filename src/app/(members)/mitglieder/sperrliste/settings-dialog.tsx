"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { SperrlisteSettingsChangePayload } from "./settings-manager";
import { SperrlisteSettingsManager } from "./settings-manager";
import type { ClientSperrlisteSettings } from "@/lib/sperrliste-settings";

interface SperrlisteSettingsDialogProps {
  settings: ClientSperrlisteSettings;
  defaultHolidaySourceUrl: string;
  defaultPublicHolidaySourceUrl: string;
  onSettingsChange?: (payload: SperrlisteSettingsChangePayload) => void;
}

export function SperrlisteSettingsDialog({
  settings,
  defaultHolidaySourceUrl,
  defaultPublicHolidaySourceUrl,
  onSettingsChange,
}: SperrlisteSettingsDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto w-full justify-center gap-2 rounded-xl border border-transparent px-4 py-2 text-sm font-semibold text-muted-foreground shadow-none hover:border-primary/20 hover:bg-primary/10 hover:text-foreground sm:w-auto sm:rounded-full sm:px-5 sm:text-sm sm:uppercase sm:tracking-wide"
        >
          <Settings2 className="h-4 w-4" aria-hidden />
          <span>Sperrlisten-Einstellungen</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-hidden border-0 bg-transparent p-0 sm:max-w-5xl">
        <div className="max-h-[90vh] overflow-y-auto">
          <SperrlisteSettingsManager
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
