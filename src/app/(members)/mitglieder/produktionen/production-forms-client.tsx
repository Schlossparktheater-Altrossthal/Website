"use client";

import { useActionState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { ProductionActionResult } from "./actions";
import {
  clearActiveProductionAction,
  createProductionAction,
  setActiveProductionAction,
} from "./actions";

const INITIAL_ACTION_STATE: ProductionActionResult = { ok: true };

type CreateProductionFormProps = {
  suggestedYear: number;
  shouldSetActiveByDefault: boolean;
  redirectPath: string;
};

export function CreateProductionForm({
  suggestedYear,
  shouldSetActiveByDefault,
  redirectPath,
}: CreateProductionFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = useCallback(
    async (_state: ProductionActionResult, formData: FormData) => {
      return createProductionAction(formData);
    },
    [],
  );
  const [state, formAction, isPending] = useActionState(action, INITIAL_ACTION_STATE);
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    if (!state.ok) {
      toast.error(state.error);
      return;
    }
    const message = state.message ?? "Produktion wurde erstellt.";
    toast.success(message);
    formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-6">
      <input type="hidden" name="redirectPath" value={redirectPath} />
      <fieldset className="grid gap-3 rounded-lg border border-border/60 bg-background/70 p-4 sm:grid-cols-2">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Basisdaten
        </legend>
        <div className="space-y-1">
          <label className="text-sm font-medium">Jahr</label>
          <Input type="number" name="year" min={1900} max={2200} defaultValue={suggestedYear} required />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Titel</label>
          <Input name="title" placeholder="Titel der Produktion" maxLength={160} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm font-medium">Kurzbeschreibung</label>
          <Textarea
            name="synopsis"
            rows={3}
            maxLength={600}
            placeholder="Optionaler Teaser, Autor oder kurzes Motto."
          />
        </div>
      </fieldset>

      <details className="rounded-lg border border-border/60 bg-background/60 p-4 transition [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-foreground">
          <span>Timeline &amp; Kommunikation (optional)</span>
          <span className="text-xs text-muted-foreground">Bereich öffnen</span>
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Startdatum</label>
            <Input type="date" name="startDate" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Enddatum</label>
            <Input type="date" name="endDate" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm font-medium">Beginn der Endprobenwoche</label>
            <Input type="date" name="finalRehearsalWeekStart" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm font-medium">Premierenankündigung</label>
            <Input type="date" name="revealDate" />
          </div>
        </div>
      </details>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="setActive"
            defaultChecked={shouldSetActiveByDefault}
            className="mt-1 h-4 w-4 rounded border border-border bg-background text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
          <span className="leading-snug">Nach dem Anlegen als aktive Produktion setzen</span>
        </label>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Button type="submit" className="sm:w-auto" disabled={isPending}>
            Produktion erstellen
          </Button>
          {!state.ok ? (
            <p role="alert" aria-live="assertive" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}

type SetActiveProductionFormProps = {
  showId: string;
  showTitle: string;
  redirectPath: string;
  isActive: boolean;
  className?: string;
};

export function SetActiveProductionForm({
  showId,
  showTitle,
  redirectPath,
  isActive,
  className,
}: SetActiveProductionFormProps) {
  const action = useCallback(
    async (_state: ProductionActionResult, formData: FormData) => {
      return setActiveProductionAction(formData);
    },
    [],
  );
  const [state, formAction, isPending] = useActionState(action, INITIAL_ACTION_STATE);
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    if (!state.ok) {
      toast.error(state.error);
      return;
    }
    const message = state.message ?? `Aktive Produktion: ${showTitle}`;
    toast.success(message);
  }, [showTitle, state]);

  return (
    <form action={formAction} className={cn("flex-shrink-0", className)}>
      <input type="hidden" name="showId" value={showId} />
      <input type="hidden" name="redirectPath" value={redirectPath} />
      <Button type="submit" size="sm" disabled={isPending || isActive}>
        {isActive ? "Aktiv ausgewählt" : "Als aktiv setzen"}
      </Button>
      {!state.ok ? (
        <p role="alert" aria-live="assertive" className="mt-2 text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

type ClearActiveProductionFormProps = {
  redirectPath: string;
  className?: string;
};

export function ClearActiveProductionForm({ redirectPath, className }: ClearActiveProductionFormProps) {
  const action = useCallback(
    async (_state: ProductionActionResult, formData: FormData) => {
      return clearActiveProductionAction(formData);
    },
    [],
  );
  const [state, formAction, isPending] = useActionState(action, INITIAL_ACTION_STATE);
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    if (!state.ok) {
      toast.error(state.error);
      return;
    }
    const message = state.message ?? "Aktive Produktion wurde zurückgesetzt.";
    toast.success(message);
  }, [state]);

  return (
    <form action={formAction} className={cn("flex-shrink-0", className)}>
      <input type="hidden" name="redirectPath" value={redirectPath} />
      <Button type="submit" variant="ghost" size="sm" disabled={isPending}>
        Aktive Auswahl zurücksetzen
      </Button>
      {!state.ok ? (
        <p role="alert" aria-live="assertive" className="mt-2 text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
