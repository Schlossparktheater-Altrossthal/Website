"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import type { ProductionActionResult } from "./actions";
import {
  clearActiveProductionAction,
  createProductionAction,
  setActiveProductionAction,
  updateProductionAction,
} from "./actions";

const INITIAL_ACTION_STATE: ProductionActionResult = { ok: false, error: "" };

function formatDateInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const source = value instanceof Date ? value : new Date(value);
  if (!Number.isNaN(source.getTime())) {
    return source.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return "";
}

function extractDateRangeInput(raw: unknown): { start: string; end: string } {
  const fromArray = (values: unknown[]): { start: string; end: string } => {
    const normalized = values
      .map((value) => {
        if (value && typeof value === "object" && "date" in (value as Record<string, unknown>)) {
          return formatDateInput((value as Record<string, unknown>).date as string | Date | null | undefined);
        }
        return formatDateInput(value as string | Date | null | undefined);
      })
      .filter((value): value is string => Boolean(value));
    if (normalized.length === 0) {
      return { start: "", end: "" };
    }
    const sorted = [...normalized].sort();
    return { start: sorted[0], end: sorted[sorted.length - 1] };
  };

  if (!raw) {
    return { start: "", end: "" };
  }

  if (Array.isArray(raw)) {
    return fromArray(raw);
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { start: "", end: "" };
    }
    if (trimmed.includes("/")) {
      const [start, end] = trimmed.split("/", 2);
      return { start: formatDateInput(start), end: formatDateInput(end) };
    }
    return { start: formatDateInput(trimmed), end: "" };
  }

  if (raw instanceof Date) {
    return { start: formatDateInput(raw), end: formatDateInput(raw) };
  }

  if (typeof raw === "object") {
    const candidate = raw as Record<string, unknown>;
    const startCandidate = candidate.start ?? candidate.begin ?? candidate.from ?? candidate.date;
    const endCandidate = candidate.end ?? candidate.until ?? candidate.to ?? candidate.finish;
    return {
      start: formatDateInput(startCandidate as string | Date | null | undefined),
      end: formatDateInput(endCandidate as string | Date | null | undefined),
    };
  }

  return { start: "", end: "" };
}

type CreateProductionFormProps = {
  suggestedYear: number;
  shouldSetActiveByDefault: boolean;
  redirectPath: string;
  onSuccess?: () => void;
};

export function CreateProductionForm({
  suggestedYear,
  shouldSetActiveByDefault,
  redirectPath,
  onSuccess,
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
    onSuccess?.();
    formRef.current?.reset();
  }, [state, onSuccess]);

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
            <DateInput name="startDate" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Enddatum</label>
            <DateInput name="endDate" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Beginn der Endprobenwoche</label>
            <DateInput name="finalRehearsalWeekStart" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Ende der Endprobenwoche</label>
            <DateInput name="finalRehearsalWeekEnd" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm font-medium">Premierenankündigung</label>
            <DateInput name="revealDate" />
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

type CreateProductionDialogProps = {
  suggestedYear: number;
  shouldSetActiveByDefault: boolean;
  redirectPath: string;
  trigger?: ReactNode;
};

export function CreateProductionDialog({
  suggestedYear,
  shouldSetActiveByDefault,
  redirectPath,
  trigger,
}: CreateProductionDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button>Neue Produktion anlegen</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="space-y-2">
          <DialogTitle>Neue Produktion anlegen</DialogTitle>
          <DialogDescription>
            Erfasse Jahrgang, optionale Beschreibung und starte direkt in den modernen
            Gewerke-, Rollen- und Szenen-Workflows.
          </DialogDescription>
        </DialogHeader>
        <CreateProductionForm
          redirectPath={redirectPath}
          suggestedYear={suggestedYear}
          shouldSetActiveByDefault={shouldSetActiveByDefault}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
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

type UpdateProductionFormProps = {
  show: {
    id: string;
    year: number;
    title: string | null;
    synopsis: string | null;
    dates: unknown;
    revealedAt: string | Date | null;
  };
  redirectPath: string;
  onSuccess?: () => void;
};

export function UpdateProductionForm({ show, redirectPath, onSuccess }: UpdateProductionFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = useCallback(
    async (_state: ProductionActionResult, formData: FormData) => {
      return updateProductionAction(formData);
    },
    [],
  );
  const [state, formAction, isPending] = useActionState(action, INITIAL_ACTION_STATE);
  const isInitialRender = useRef(true);

  const { start: startDate, end: endDate } = extractDateRangeInput(show.dates);
  const revealDate = formatDateInput(show.revealedAt);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    if (!state.ok) {
      toast.error(state.error);
      return;
    }
    const message = state.message ?? "Produktion wurde aktualisiert.";
    toast.success(message);
    onSuccess?.();
    formRef.current?.reset();
  }, [state, onSuccess]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-6">
      <input type="hidden" name="showId" value={show.id} />
      <input type="hidden" name="redirectPath" value={redirectPath} />
      <fieldset className="grid gap-3 rounded-lg border border-border/60 bg-background/70 p-4 sm:grid-cols-2">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Basisdaten
        </legend>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor={`year-${show.id}`}>
            Jahr
          </label>
          <Input
            id={`year-${show.id}`}
            type="number"
            name="year"
            min={1900}
            max={2200}
            defaultValue={show.year}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor={`title-${show.id}`}>
            Titel
          </label>
          <Input id={`title-${show.id}`} name="title" defaultValue={show.title ?? ""} maxLength={160} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm font-medium" htmlFor={`synopsis-${show.id}`}>
            Kurzbeschreibung
          </label>
          <Textarea
            id={`synopsis-${show.id}`}
            name="synopsis"
            rows={3}
            maxLength={600}
            defaultValue={show.synopsis ?? ""}
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
            <label className="text-sm font-medium" htmlFor={`startDate-${show.id}`}>
              Startdatum
            </label>
            <DateInput id={`startDate-${show.id}`} name="startDate" defaultValue={startDate} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor={`endDate-${show.id}`}>
              Enddatum
            </label>
            <DateInput id={`endDate-${show.id}`} name="endDate" defaultValue={endDate} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm font-medium" htmlFor={`revealDate-${show.id}`}>
              Premierenankündigung
            </label>
            <DateInput id={`revealDate-${show.id}`} name="revealDate" defaultValue={revealDate} />
          </div>
        </div>
      </details>

      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Button type="submit" className="sm:w-auto" disabled={isPending}>
            Produktion aktualisieren
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

type UpdateProductionDialogProps = {
  show: UpdateProductionFormProps["show"];
  redirectPath: string;
  trigger?: ReactNode;
};

export function UpdateProductionDialog({ show, redirectPath, trigger }: UpdateProductionDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button>Produktion bearbeiten</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="space-y-2">
          <DialogTitle>Produktion bearbeiten</DialogTitle>
          <DialogDescription>
            Aktualisiere Jahrgang, optionale Beschreibung sowie Zeitraum deiner Produktion. Änderungen werden
            direkt im Workspace übernommen.
          </DialogDescription>
        </DialogHeader>
        <UpdateProductionForm show={show} redirectPath={redirectPath} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
