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

const MIN_REASON = 3;

/**
 * Absage – innerhalb der Sperrfrist als Notfall mit Pflicht-Begründung, sonst als normale Sperre
 * mit freiwilligem Grund. Beides legt einen Eintrag in der Sperrliste an; „Doch dabei" nimmt ihn
 * wieder weg.
 */
export function DeclineControl({
  eventId,
  title,
  declined,
  note,
  tentative = false,
  emergency = false,
  withinFreeze = false,
}: {
  eventId: string;
  title: string;
  declined: boolean;
  note: string | null;
  tentative?: boolean;
  /** Die Absage war ein Notfall (innerhalb der Sperrfrist). */
  emergency?: boolean;
  /** Der Termin liegt innerhalb der Sperrfrist: Absage nur im Notfall, Grund ist Pflicht. */
  withinFreeze?: boolean;
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
      toast.success(result.emergency ? "Notfall-Absage gespeichert" : "Abgesagt", {
        description: result.emergency
          ? "Die Planung ist informiert; der Tag steht in der Sperrliste als Notfall."
          : "Der Tag steht in der Sperrliste als gesperrt.",
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
      toast.success("Du bist wieder dabei", {
        description: "Der Eintrag in der Sperrliste ist entfernt.",
        duration: 3000,
      });
      router.refresh();
    });

  if (declined) {
    return (
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Badge variant="outline" className="border-destructive bg-destructive/10 text-destructive">
          {emergency ? "abgesagt (Notfall)" : "abgesagt"}
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
        title={withinFreeze ? "Notfall-Absage" : "Absagen"}
        description={
          withinFreeze
            ? `„${title}“ liegt innerhalb der Sperrfrist. Sag nur im Notfall ab: Die Planung wird sofort informiert und der Tag erscheint in der Sperrliste als Notfall.`
            : tentative
              ? `„${title}“ ist erst vorgemerkt. Sag ruhig schon jetzt ab, dann kann die Planung das berücksichtigen.`
              : `Du kannst nicht zu „${title}“ kommen? Die Planung wird benachrichtigt; der Tag erscheint in der Sperrliste als gesperrt.`
        }
        open={open}
        onOpenChange={setOpen}
        footer={
          <AsyncButton
            type="button"
            variant="destructive"
            isLoading={pending}
            loadingText="Sagt ab…"
            disabled={withinFreeze && reason.trim().length < MIN_REASON}
            onClick={submit}
          >
            {withinFreeze ? "Notfall-Absage senden" : "Absage senden"}
          </AsyncButton>
        }
      >
        <div className="space-y-2">
          <Label htmlFor={fieldId}>
            Warum kannst du nicht?{withinFreeze ? " (Pflicht)" : " (freiwillig)"}
          </Label>
          <Textarea
            id={fieldId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="z. B. krank, Schichtdienst"
          />
          <p className="text-xs text-muted-foreground">
            {withinFreeze
              ? "Der Grund ist für die Planung sichtbar und steht in der Sperrliste am Termintag."
              : "Bekannte Abwesenheiten trägst du am besten schon vorher in die Sperrliste ein."}
          </p>
        </div>
      </ModalFormDialog>
    </div>
  );
}
