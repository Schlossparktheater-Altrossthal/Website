"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { saveAttendanceAction } from "./actions";

export function AttendanceForm({ rehearsalId }: { rehearsalId: string }) {
  const [pending, start] = useTransition();

  function onClick(status: "yes" | "no" | "maybe") {
    start(async () => {
      try {
        await saveAttendanceAction(rehearsalId, status);
        toast.success("Teilnahme gespeichert");
      } catch (e) {
        const message = e instanceof Error ? e.message : "Fehler beim Speichern";
        toast.error(message);
      }
    });
  }

  return (
    <div className="flex gap-2" role="group" aria-label="Proben-Zusage">
      <Button disabled={pending} onClick={() => onClick("yes")}>Ja</Button>
      <Button disabled={pending} variant="outline" onClick={() => onClick("maybe")}>Vielleicht</Button>
      <Button disabled={pending} variant="outline" onClick={() => onClick("no")}>Nein</Button>
    </div>
  );
}
