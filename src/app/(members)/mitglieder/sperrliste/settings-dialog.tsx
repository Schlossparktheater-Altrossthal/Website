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
  onSettingsChange?: (payload: SperrlisteSettingsChangePayload) => void;
}

export function SperrlisteSettingsDialog({
  settings,
  defaultHolidaySourceUrl,
  onSettingsChange,
}: SperrlisteSettingsDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings2 className="h-4 w-4" aria-hidden />
          <span>Sperrlisten-Einstellungen</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-hidden border-0 bg-transparent p-0 sm:max-w-5xl">
        <div className="max-h-[90vh] overflow-y-auto">
          <SperrlisteSettingsManager
            settings={settings}
            defaultHolidaySourceUrl={defaultHolidaySourceUrl}
            onSettingsChange={(payload) => {
              onSettingsChange?.(payload);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
