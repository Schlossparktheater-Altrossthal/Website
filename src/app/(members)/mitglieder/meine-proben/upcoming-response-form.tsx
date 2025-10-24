"use client";

import { useMemo } from "react";
import { useFormState } from "react-dom";

import { Button } from "@/components/ui/button";

import type { AttendanceActionState } from "./actions";
import { INITIAL_ATTENDANCE_STATE, respondToRehearsal } from "./actions";

type UpcomingRehearsalResponseFormProps = {
  rehearsalId: string;
  currentStatus: "yes" | "no" | "maybe" | "emergency" | "open";
  canDecline: boolean;
};

export function UpcomingRehearsalResponseForm({
  rehearsalId,
  currentStatus,
  canDecline,
}: UpcomingRehearsalResponseFormProps) {
  const initialState = useMemo(
    () => ({ ...INITIAL_ATTENDANCE_STATE }),
    [],
  );
  const [state, formAction] = useFormState<AttendanceActionState, FormData>(
    respondToRehearsal,
    initialState,
  );

  const successMessage = state.ok && !state.error ? "Rückmeldung gespeichert." : null;

  return (
    <form action={formAction} className="space-y-2 text-sm">
      <input type="hidden" name="rehearsalId" value={rehearsalId} />
      <div className="flex flex-wrap gap-2">
        <Button
          key={`${rehearsalId}-yes-${currentStatus}`}
          type="submit"
          name="status"
          value="yes"
          size="sm"
          variant={currentStatus === "yes" ? "default" : "outline"}
        >
          Zusagen
        </Button>
        <Button
          key={`${rehearsalId}-no-${currentStatus}`}
          type="submit"
          name="status"
          value="no"
          size="sm"
          variant={currentStatus === "no" ? "default" : "outline"}
          disabled={!canDecline}
        >
          Absagen
        </Button>
      </div>
      {state.error ? <p className="text-xs text-rose-600">{state.error}</p> : null}
      {successMessage ? <p className="text-xs text-emerald-600">{successMessage}</p> : null}
    </form>
  );
}
