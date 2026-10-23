"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createDoorAccessAction } from "@/app/(members)/mitglieder/karten/einstellungen/actions";
import { DoorQrDialog } from "@/components/karten/settings/door-qr-dialog";
import { AsyncButton } from "@/components/ui/async-button";
import { QrCodeIcon } from "@/components/ui/action-icons";
import { DEFAULT_TIME_ZONE } from "@/lib/format/date";

/** Vor Ort: QR-Code erzeugen, mit dem sich Helfer ohne Konto in den Einlass einklinken (gilt 1 Tag). */
export function DoorHelperQrButton({ showId }: { showId: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const title = `Einlass ${new Intl.DateTimeFormat("de-DE", {
    timeZone: DEFAULT_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
  }).format(new Date())}`;
  return (
    <>
      <AsyncButton
        size="sm"
        variant="outline"
        isLoading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await createDoorAccessAction(showId, { name: title, days: 1 });
            if (result.ok) setLink(result.data.link);
            else toast.error(result.error);
          })
        }
      >
        <QrCodeIcon /> Helfer-QR
      </AsyncButton>
      {link ? <DoorQrDialog link={link} title={title} onClose={() => setLink(null)} /> : null}
    </>
  );
}
