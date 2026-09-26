"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { Textarea } from "@/components/ui/textarea";

import { declineRehearsalAction, withdrawDeclineAction } from "./actions";

/** Absage mit Pflicht-Begründung – oder eine Absage wieder zurücknehmen. */
export function DeclineControl({
  eventId,
  title,
  declined,
  note,
}: {
  eventId: string;
  title: string;
  declined: boolean;
  note: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const result = await declineRehearsalAction({ eventId, reason });
      if (!result.ok) {
        toast.error("Absage nicht gespeichert", { description: result.error, duration: 5000 });
        return;
      }
      toast.success("Abgesagt", {
        description: "Die Planung ist informiert.",
        duration: 3000,
      });
      setOpen(false);
      setReason("");
      router.refresh();
    });

  const withdraw = () =>
    startTransition(async () => {
      const result = await withdrawDeclineAction({ eventId });
      if (!result.ok) {
        toast.error("Das hat nicht geklappt", { description: result.error, duration: 5000 });
        return;
      }
      toast.success("Du bist wieder dabei", { duration: 3000 });
      router.refresh();
    });

  if (declined) {
    return (
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Badge variant="outline" className="border-destructive bg-destructive/10 text-destructive">
          abgesagt
        </Badge>
        {note ? <span className="text-xs text-muted-foreground">„{note}“</span> : null}
        <AsyncButton
          type="button"
          variant="ghost"
          size="sm"
          isLoading={pending}
          loadingText="Speichert…"
          onClick={withdraw}
        >
          Doch dabei
        </AsyncButton>
      </div>
    );
  }

  const fieldId = `decline-reason-${eventId}`;
  return (
    <div className="pt-1">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Absagen
      </Button>
      <ModalFormDialog
        title="Absagen"
        description={`Du kannst nicht zu „${title}“ kommen? Die Planung wird benachrichtigt.`}
        open={open}
        onOpenChange={setOpen}
        footer={
          <AsyncButton
            type="button"
            variant="destructive"
            isLoading={pending}
            loadingText="Sagt ab…"
            disabled={reason.trim().length < 3}
            onClick={submit}
          >
            Absage senden
          </AsyncButton>
        }
      >
        <div className="space-y-2">
          <Label htmlFor={fieldId}>Warum kannst du nicht?</Label>
          <Textarea
            id={fieldId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="z. B. krank, Schichtdienst"
          />
          <p className="text-xs text-muted-foreground">
            Bekannte Abwesenheiten trägst du am besten schon vorher in die Sperrliste ein.
          </p>
        </div>
      </ModalFormDialog>
    </div>
  );
}
