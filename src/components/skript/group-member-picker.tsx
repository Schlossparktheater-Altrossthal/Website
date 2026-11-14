"use client";

import * as React from "react";

import { AsyncButton } from "@/components/ui/async-button";

/**
 * Auswahl „wer spricht mit“: Personengruppen als Ganzes, darunter einzelne Rollen
 * (docs/Plan/gruppen-plan.md). Gemeinsam für Rollen-Seite und Skript-Leser.
 */

export type PickerSet = { id: string; name: string; memberRoleIds: string[] };
export type PickerRole = { id: string; name: string };
export type PickerValue = { roleIds: string[]; setIds: string[] };

function Chip({
  active,
  onClick,
  children,
  strong,
  disabled,
}: {
  disabled?: boolean;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={
        (active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-background text-muted-foreground hover:text-foreground") +
        " min-h-9 rounded-full border px-3 text-sm disabled:opacity-60" +
        (strong ? " font-medium" : "")
      }
    >
      {children}
    </button>
  );
}

const toggle = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

export function GroupMemberPicker({
  people,
  sets,
  initial,
  pending,
  onSave,
  saveLabel = "Übernehmen",
}: {
  people: PickerRole[];
  sets: PickerSet[];
  initial: PickerValue;
  pending: boolean;
  onSave: (value: PickerValue) => void;
  saveLabel?: string;
}) {
  const [roleIds, setRoleIds] = React.useState(initial.roleIds);
  const [setIds, setSetIds] = React.useState(initial.setIds);
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
  const dirty = !same(roleIds, initial.roleIds) || !same(setIds, initial.setIds);
  const coveredBySet = new Set(
    sets.filter((s) => setIds.includes(s.id)).flatMap((s) => s.memberRoleIds),
  );
  return (
    <div className="space-y-3">
      {sets.length ? (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Personengruppen</p>
          <div className="flex flex-wrap gap-2">
            {sets.map((set) => (
              <Chip
                key={set.id}
                strong
                active={setIds.includes(set.id)}
                onClick={() => setSetIds((ids) => toggle(ids, set.id))}
              >
                {set.name} <span className="opacity-60">{set.memberRoleIds.length}</span>
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
      <div className="space-y-1.5">
        {sets.length ? <p className="text-xs text-muted-foreground">Einzelne Rollen</p> : null}
        <div className="flex flex-wrap gap-2">
          {people.map((person) => (
            <Chip
              key={person.id}
              active={roleIds.includes(person.id) || coveredBySet.has(person.id)}
              disabled={coveredBySet.has(person.id) && !roleIds.includes(person.id)}
              onClick={() => setRoleIds((ids) => toggle(ids, person.id))}
            >
              {person.name}
            </Chip>
          ))}
        </div>
      </div>
      {dirty ? (
        <AsyncButton size="sm" isLoading={pending} onClick={() => onSave({ roleIds, setIds })}>
          {saveLabel}
        </AsyncButton>
      ) : null}
    </div>
  );
}
