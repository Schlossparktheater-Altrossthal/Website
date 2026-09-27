"use client";

import { CloseIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimeInput } from "@/components/ui/time-input";
import type { AudienceContext } from "@/lib/calendar/audience";

export type EventBlockValue = {
  id: string;
  type: "DEPARTMENT" | "CUSTOM";
  title: string;
  departmentId: string | null;
  start: string;
  end: string;
  location: string;
  description: string;
};

function newBlock(type: EventBlockValue["type"], departmentId: string | null = null) {
  return {
    id: crypto.randomUUID(),
    type,
    title: "",
    departmentId,
    start: "",
    end: "",
    location: "",
    description: "",
  } satisfies EventBlockValue;
}

/**
 * Weitere Bausteine neben den Szenen: Gewerk-Bausteine (laden das Gewerk ein, Details pflegt
 * die Gewerk-Leitung) und freie Bausteine. Bausteine dürfen parallel in eigenen Räumen laufen.
 */
export function EventBlocksEditor({
  context,
  blocks,
  onChange,
}: {
  context: AudienceContext;
  blocks: EventBlockValue[];
  onChange: (blocks: EventBlockValue[]) => void;
}) {
  const update = (id: string, patch: Partial<EventBlockValue>) =>
    onChange(blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)));
  const departmentName = (id: string | null) =>
    context.departments.find((entry) => entry.id === id)?.name ?? "Gewerk";

  return (
    <div className="space-y-3">
      {blocks.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {blocks.map((block) => {
            const isDepartment = block.type === "DEPARTMENT";
            const label = isDepartment ? departmentName(block.departmentId) : "Baustein";
            return (
              <li key={block.id} className="space-y-2 p-3">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs font-medium">
                    {isDepartment ? `Gewerk ${label}` : "Frei"}
                  </span>
                  <Input
                    value={block.title}
                    onChange={(event) => update(block.id, { title: event.target.value })}
                    placeholder={isDepartment ? "z. B. Bühnenbau" : "z. B. Einsingen"}
                    maxLength={120}
                    aria-label={`Titel ${label}`}
                    className="h-9"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 shrink-0 p-0"
                    onClick={() => onChange(blocks.filter((entry) => entry.id !== block.id))}
                    aria-label={`${block.title || label} entfernen`}
                  >
                    <CloseIcon className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <TimeInput
                      value={block.start}
                      onChange={(event) => update(block.id, { start: event.target.value })}
                      aria-label={`Beginn ${block.title || label}`}
                      className="flex-1 sm:w-28 sm:flex-none"
                    />
                    <span className="text-muted-foreground">–</span>
                    <TimeInput
                      value={block.end}
                      onChange={(event) => update(block.id, { end: event.target.value })}
                      aria-label={`Ende ${block.title || label}`}
                      className="flex-1 sm:w-28 sm:flex-none"
                    />
                  </div>
                  {isDepartment ? (
                    <p className="text-xs text-muted-foreground">
                      {block.location ? `Raum: ${block.location} · ` : ""}
                      Alle Mitglieder des Gewerks sind eingeladen. Raum, Ablauf und Personen regelt
                      die Gewerk-Leitung.
                    </p>
                  ) : (
                    <Input
                      value={block.location}
                      onChange={(event) => update(block.id, { location: event.target.value })}
                      placeholder="Raum (optional)"
                      maxLength={120}
                      aria-label={`Raum ${block.title || label}`}
                      className="h-9 sm:w-48"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        {context.departments.length ? (
          <Select
            value=""
            onValueChange={(departmentId) =>
              onChange([...blocks, newBlock("DEPARTMENT", departmentId)])
            }
          >
            <SelectTrigger className="h-11 w-full sm:h-9 sm:w-64" aria-label="Gewerk-Baustein">
              <SelectValue placeholder="+ Gewerk-Baustein" />
            </SelectTrigger>
            <SelectContent>
              {context.departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11 sm:h-9"
          onClick={() => onChange([...blocks, newBlock("CUSTOM")])}
        >
          + Freier Baustein
        </Button>
      </div>
    </div>
  );
}
