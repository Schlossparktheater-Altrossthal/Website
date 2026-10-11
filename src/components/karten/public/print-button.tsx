"use client";

import { Button } from "@/components/ui/button";
import { PrinterIcon } from "@/components/ui/action-icons";

export function PrintButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <PrinterIcon /> Ticket drucken
    </Button>
  );
}
