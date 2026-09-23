"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import type { ProductionStatus } from "@prisma/client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductionActionResult } from "@/lib/produktionen/actions-helpers";
import {
  PRODUCTION_STATUSES,
  PRODUCTION_STATUS_LABELS,
  isProductionStatus,
  shouldCloseMemberships,
} from "@/lib/produktionen/status";

import { setProductionStatusAction } from "./actions/status";

const INITIAL_ACTION_STATE: ProductionActionResult = { ok: false, error: "" };

type ProductionStatusFormProps = {
  showId: string;
  showTitle: string;
  status: ProductionStatus;
  redirectPath: string;
};

export function ProductionStatusForm({
  showId,
  showTitle,
  status,
  redirectPath,
}: ProductionStatusFormProps) {
  const action = useCallback(async (_state: ProductionActionResult, formData: FormData) => {
    return setProductionStatusAction(formData);
  }, []);
  const [state, formAction, isPending] = useActionState(action, INITIAL_ACTION_STATE);
  const [selected, setSelected] = useState<ProductionStatus>(status);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    if (!state.ok) {
      if (state.error) toast.error(state.error);
      return;
    }
    toast.success(state.message ?? "Status wurde geändert.");
  }, [state]);

  const needsConfirmation = shouldCloseMemberships(selected) && !shouldCloseMemberships(status);
  const selectId = `production-status-${showId}`;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        if (needsConfirmation && !confirmOpen) {
          event.preventDefault();
          setConfirmOpen(true);
        }
      }}
    >
      <input type="hidden" name="showId" value={showId} />
      <input type="hidden" name="status" value={selected} />
      <input type="hidden" name="redirectPath" value={redirectPath} />
      <label htmlFor={selectId} className="sr-only">
        Status von {showTitle}
      </label>
      <Select
        value={selected}
        onValueChange={(value) => {
          if (isProductionStatus(value)) setSelected(value);
        }}
      >
        <SelectTrigger id={selectId} className="h-9 w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRODUCTION_STATUSES.map((option) => (
            <SelectItem key={option} value={option}>
              {PRODUCTION_STATUS_LABELS[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" size="sm" variant="outline" disabled={isPending || selected === status}>
        Status setzen
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`„${showTitle}“ ${selected === "archived" ? "archivieren" : "beenden"}?`}
        description="Alle Mitgliedschaften dieser Produktion werden beendet. Wer in keiner anderen geplanten oder aktiven Produktion ist, kann danach über „Saison abschließen“ deaktiviert werden."
        confirmLabel={selected === "archived" ? "Archivieren" : "Beenden"}
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={() => {
          setConfirmOpen(false);
          formRef.current?.requestSubmit();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </form>
  );
}
