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
 * QR-Code für den Einlass-Zugang. Er wird nur einmal angezeigt (in der DB liegt nur der Hash) –
 * deshalb gleich drucken; ein neuer Code macht den alten ungültig.
 */
export function DoorQrDialog({
  link,
  title,
  onClose,
}: {
  link: string;
  title: string;
  onClose: () => void;
}) {
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
      .write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Einlass</title>
      <style>body{font-family:system-ui,sans-serif;text-align:center;padding:40px}svg{width:340px;height:340px}
      h1{font-size:28px;margin:0 0 8px}p{font-size:16px;color:#333;max-width:460px;margin:12px auto}</style></head>
      <body><h1>Einlass – ${escapeHtml(title)}</h1>
      <p>Mit dem Handy scannen, um den Einlass zu öffnen. Kein Konto nötig.</p>${svg}
      <p>Bitte nicht öffentlich aushängen – der Code öffnet die Gästeliste.</p>
      <script>window.onload=()=>{window.print()}</script></body></html>`);
    win.document.close();
  };

  return (
    <ModalFormDialog
      title="Einlass-QR"
      description="Die Einlasser scannen den Code mit dem Handy und landen direkt im Einlass."
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
        <p className="text-sm text-muted-foreground">
          Der Code wird nur jetzt angezeigt. Bitte drucken oder auf die Geräte übertragen. Mit
          „Neuer QR“ entsteht später ein neuer Code, der alte gilt dann nicht mehr.
        </p>
      </div>
    </ModalFormDialog>
  );
}
