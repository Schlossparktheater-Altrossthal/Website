"use client";

import QRCode from "qrcode";
import * as React from "react";
import { toast } from "sonner";

import { CopyIcon, ShareIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";

const timeFormat = new Intl.DateTimeFormat("de-DE", {
  timeStyle: "short",
  timeZone: DEFAULT_TIME_ZONE,
});

/**
 * Einmal-Anmeldelink (Passkey statt Passwort): vor Ort als QR-Code scannen lassen
 * oder per Messenger teilen. Wer den Link hat, kommt ins Konto – nur der Person
 * selbst geben.
 */
export function MemberLoginLinkDialog({
  link,
  expiresAt,
  displayName,
  onClose,
}: {
  link: string;
  expiresAt: string;
  displayName: string;
  onClose: () => void;
}) {
  const [svg, setSvg] = React.useState<string | null>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  React.useEffect(() => {
    let cancelled = false;
    void QRCode.toString(link, { type: "svg", errorCorrectionLevel: "M", margin: 1 }).then(
      (value) => {
        if (!cancelled) setSvg(value);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [link]);

  const message = `Hallo ${displayName}, mit diesem Link richtest du deinen Zugang zum Mitgliederbereich ein (Fingerabdruck oder Gesicht, kein Passwort). Er gilt bis ${timeFormat.format(new Date(expiresAt))} Uhr und nur einmal: ${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Nachricht mit Link kopiert");
    } catch {
      toast.error("Kopieren hat nicht geklappt – Link bitte markieren und kopieren.");
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: "Zugang Mitgliederbereich", text: message });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Teilen hat nicht geklappt.");
    }
  };

  return (
    <ModalFormDialog
      title="Anmeldelink"
      description={`Gilt einmal bis ${timeFormat.format(new Date(expiresAt))} Uhr. Damit richtet ${displayName} einen Passkey ein und ist angemeldet.`}
      open
      onOpenChange={(open) => (!open ? onClose() : undefined)}
      footer={
        <>
          <Button variant="outline" onClick={() => void copy()}>
            <CopyIcon /> Kopieren
          </Button>
          {canShare ? (
            <Button onClick={() => void share()}>
              <ShareIcon /> Teilen
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-3 text-center">
        <p className="text-sm text-muted-foreground">
          Vor Ort: {displayName} scannt den Code mit dem eigenen Handy. Sonst per Messenger
          schicken.
        </p>
        {svg ? (
          <div
            className="mx-auto w-56 rounded-md bg-white p-3"
            role="img"
            aria-label="QR-Code mit dem Anmeldelink"
            // SVG aus der eigenen QR-Bibliothek.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : null}
        <p className="break-all rounded-md bg-muted px-3 py-2 text-left font-mono text-xs">
          {link}
        </p>
        <p className="text-xs text-muted-foreground">
          Wer den Link hat, kommt in das Konto. Nur an {displayName} selbst geben. Abgelaufen?
          Einfach einen neuen erzeugen.
        </p>
      </div>
    </ModalFormDialog>
  );
}
