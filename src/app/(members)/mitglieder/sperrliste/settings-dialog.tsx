"use client";

import { useState } from "react";

import { Settings2Icon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { ClientSperrlisteSettings } from "@/lib/sperrliste-settings";

import { BlocklistSettingsManager, type SperrlisteSettingsChangePayload } from "./settings-manager";

interface BlocklistSettingsDialogProps {
  settings: ClientSperrlisteSettings;
  defaultHolidaySourceUrl: string;
  defaultPublicHolidaySourceUrl: string;
  onSettingsChange?: (payload: SperrlisteSettingsChangePayload) => void;
}

const TITLE = "Sperrlisten-Einstellungen";
const DESCRIPTION = "Probentage, Sperrfrist sowie Ferien und Feiertage.";

export function BlocklistSettingsDialog(props: BlocklistSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 640px)");

  const trigger = (
    <Button variant="outline" size="sm" aria-label={TITLE} onClick={() => setOpen(true)}>
      <Settings2Icon className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Einstellungen</span>
    </Button>
  );
  const manager = <BlocklistSettingsManager {...props} onSaved={() => setOpen(false)} />;

  if (isDesktop) {
    return (
      <>
        {trigger}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{TITLE}</DialogTitle>
              <DialogDescription>{DESCRIPTION}</DialogDescription>
            </DialogHeader>
            {manager}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      {trigger}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="flex max-h-[90vh] flex-col rounded-t-2xl px-4 pb-6 pt-4"
        >
          <SheetHeader className="text-left">
            <SheetTitle>{TITLE}</SheetTitle>
            <SheetDescription>{DESCRIPTION}</SheetDescription>
          </SheetHeader>
          {manager}
        </SheetContent>
      </Sheet>
    </>
  );
}
