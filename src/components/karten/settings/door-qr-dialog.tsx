"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { CopyIcon, PrinterIcon } from "@/components/ui/action-icons";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { toast } from "sonner";

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * QR-Code eines Zugangs (Einlass oder Kartenbüro). Lässt sich in den Einstellungen unter „Zugänge“
 * jederzeit wieder anzeigen; „Neuer QR“ macht den alten Code ungültig.
 */
export function DoorQrDialog({
  link,
  title,
  door = true,
  onClose,
}: {
  link: string;
  title: string;
  /** false = Kartenbüro-Zugang (Sekretariat). */
  door?: boolean;
  onClose: () => void;
}) {
  const heading = door ? "Einlass" : "Kartenbüro";
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
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

  const print = () => {
    if (!svg) return;
    const win = window.open("", "_blank", "width=700,height=900");
    if (!win) {
      toast.error("Das Druckfenster wurde blockiert.");
      return;
    }
    win.document
      .write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${heading}</title>
      <style>body{font-family:system-ui,sans-serif;text-align:center;padding:40px}svg{width:340px;height:340px}
      h1{font-size:28px;margin:0 0 8px}p{font-size:16px;color:#333;max-width:460px;margin:12px auto}</style></head>
      <body><h1>${heading} – ${escapeHtml(title)}</h1>
      <p>Mit dem Handy scannen, um ${door ? "den Einlass" : "das Kartenbüro"} zu öffnen. Kein Konto nötig.</p>${svg}
      <p>Bitte nicht öffentlich aushängen – der Code öffnet die Gästeliste.</p>
      <script>window.onload=()=>{window.print()}</script></body></html>`);
    win.document.close();
  };

  return (
    <ModalFormDialog
      title={door ? "Einlass-QR" : `Kartenbüro-Zugang: ${title}`}
      description={
        door
          ? "Die Einlasser scannen den Code mit dem Handy und landen direkt im Einlass."
          : "Link oder QR-Code öffnen das Kartenbüro auf dem Gerät – ohne Passwort."
      }
      open
      onOpenChange={(open) => (!open ? onClose() : undefined)}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              toast.success("Link kopiert.");
            }}
          >
            <CopyIcon /> Link kopieren
          </Button>
          <Button onClick={print} disabled={!svg}>
            <PrinterIcon /> Drucken
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-center">
        {svg ? (
          <div
            className="mx-auto w-64 rounded-md bg-white p-3"
            role="img"
            aria-label="QR-Code für den Einlass"
            // SVG aus der eigenen QR-Bibliothek.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : null}
        <p className="break-all rounded-md bg-muted px-3 py-2 text-left font-mono text-xs">
          {link}
        </p>
        <p className="text-sm text-muted-foreground">
          Unter „Zugänge“ kannst du Link und Code jederzeit wieder anzeigen. „Neuer QR“ bzw. „Neuer
          Link“ macht den alten ungültig.
        </p>
      </div>
    </ModalFormDialog>
  );
}
