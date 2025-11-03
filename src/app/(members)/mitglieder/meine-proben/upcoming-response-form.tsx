"use client";

import { useMemo } from "react";
import { useFormState } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { AttendanceActionState } from "./actions";
import { INITIAL_ATTENDANCE_STATE, respondToRehearsal } from "./actions";

type ResponseStatus = "yes" | "no" | "emergency";

const DEFAULT_STATUSES: readonly ResponseStatus[] = ["yes", "no", "emergency"];

const STATUS_LABELS: Record<ResponseStatus, string> = {
  yes: "Zusage",
  no: "Absage",
  emergency: "Notfall",
};

const ACTIVE_VARIANTS: Record<ResponseStatus, ButtonProps["variant"]> = {
  yes: "success",
  no: "destructive",
  emergency: "info",
};

type UpcomingRehearsalResponseFormProps = {
  rehearsalId: string;
  currentStatus: "yes" | "no" | "maybe" | "emergency" | "open";
  canDecline: boolean;
  statuses?: readonly ResponseStatus[];
  showMessages?: boolean;
  buttonSize?: ButtonProps["size"];
  className?: string;
  buttonsClassName?: string;
};

export function UpcomingRehearsalResponseForm({
  rehearsalId,
  currentStatus,
  canDecline,
  statuses,
  showMessages = true,
  buttonSize = "sm",
  className,
  buttonsClassName,
}: UpcomingRehearsalResponseFormProps) {
  const initialState = useMemo(
    () => ({ ...INITIAL_ATTENDANCE_STATE }),
    [],
  );
  const [state, formAction] = useFormState<AttendanceActionState, FormData>(
    respondToRehearsal,
    initialState,
  );

  const successMessage = showMessages && state.ok && !state.error ? "Rückmeldung gespeichert." : null;
  const errorMessage = showMessages ? state.error : null;
  const statusesToRender = (statuses?.length ? statuses : DEFAULT_STATUSES).filter(
    (status, index, array) => array.indexOf(status) === index,
  );
  const formClassName = cn(showMessages ? "space-y-2 text-sm" : "space-y-0", className);

  return (
    <form action={formAction} className={formClassName}>
      <input type="hidden" name="rehearsalId" value={rehearsalId} />
      <div className={cn("flex flex-wrap gap-2", buttonsClassName)}>
        {statusesToRender.map((status) => {
          const isActive = currentStatus === status;
          const variant = isActive ? ACTIVE_VARIANTS[status] ?? "default" : "outline";
          const disabled = status === "no" && !canDecline;

          return (
            <Button
              key={`${rehearsalId}-${status}-${currentStatus}`}
              type="submit"
              name="status"
              value={status}
              size={buttonSize}
              variant={variant}
              disabled={disabled}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {STATUS_LABELS[status]}
            </Button>
          );
        })}
      </div>
      {errorMessage ? <p className="text-xs text-rose-600">{errorMessage}</p> : null}
      {successMessage ? <p className="text-xs text-emerald-600">{successMessage}</p> : null}
    </form>
  );
}
