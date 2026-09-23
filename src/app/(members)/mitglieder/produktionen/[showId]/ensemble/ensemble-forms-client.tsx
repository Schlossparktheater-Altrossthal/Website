"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductionActionResult } from "@/lib/produktionen/actions-helpers";
import { PRODUCTION_ROLES, type ProductionRole } from "@/lib/produktionen/production-role-keys";
import { ROLE_LABELS } from "@/lib/roles";

import {
  addProductionMemberAction,
  inviteFormerMembersAction,
  removeProductionMemberAction,
  updateProductionMemberAction,
  type InviteFormerMembersResult,
} from "../../actions/ensemble";

const INITIAL_ACTION_STATE: ProductionActionResult = { ok: false, error: "" };

function useActionToast(state: ProductionActionResult) {
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
    if (state.message) toast.success(state.message);
  }, [state]);
}

type MemberRoleFormProps = {
  membershipId: string;
  memberName: string;
  roles: ProductionRole[];
  func: string | null;
};

export function MemberRoleForm({ membershipId, memberName, roles, func }: MemberRoleFormProps) {
  const action = useCallback(
    async (_state: ProductionActionResult, formData: FormData) =>
      updateProductionMemberAction(formData),
    [],
  );
  const [state, formAction, isPending] = useActionState(action, INITIAL_ACTION_STATE);
  useActionToast(state);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="membershipId" value={membershipId} />
      {PRODUCTION_ROLES.map((role) => {
        const id = `role-${membershipId}-${role}`;
        return (
          <div key={role} className="flex items-center gap-2 text-sm">
            <Checkbox id={id} name="roles" value={role} defaultChecked={roles.includes(role)} />
            <label htmlFor={id}>{ROLE_LABELS[role]}</label>
          </div>
        );
      })}
      <label className="sr-only" htmlFor={`function-${membershipId}`}>
        Funktion von {memberName}
      </label>
      <Input
        id={`function-${membershipId}`}
        name="function"
        defaultValue={func ?? ""}
        placeholder="Funktion (z. B. Licht, Regieassistenz)"
        className="h-9 w-56"
        maxLength={120}
      />
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        Speichern
      </Button>
    </form>
  );
}

export function RemoveMemberForm({
  membershipId,
  memberName,
}: {
  membershipId: string;
  memberName: string;
}) {
  const action = useCallback(
    async (_state: ProductionActionResult, formData: FormData) =>
      removeProductionMemberAction(formData),
    [],
  );
  const [state, formAction, isPending] = useActionState(action, INITIAL_ACTION_STATE);
  useActionToast(state);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Mitgliedschaft von ${memberName} in dieser Produktion beenden?`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="membershipId" value={membershipId} />
      <Button type="submit" size="sm" variant="ghost" disabled={isPending}>
        Beenden
      </Button>
    </form>
  );
}

export type AddableMember = { id: string; label: string };

export function AddMemberForm({
  showId,
  candidates,
}: {
  showId: string;
  candidates: AddableMember[];
}) {
  const action = useCallback(
    async (_state: ProductionActionResult, formData: FormData) =>
      addProductionMemberAction(formData),
    [],
  );
  const [state, formAction, isPending] = useActionState(action, INITIAL_ACTION_STATE);
  const [userId, setUserId] = useState("");
  useActionToast(state);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="showId" value={showId} />
      <input type="hidden" name="userId" value={userId} />
      <Select value={userId} onValueChange={setUserId}>
        <SelectTrigger className="h-9 w-72" aria-label="Mitglied auswählen">
          <SelectValue placeholder="Mitglied auswählen" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((candidate) => (
            <SelectItem key={candidate.id} value={candidate.id}>
              {candidate.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" size="sm" disabled={isPending || !userId}>
        Aufnehmen
      </Button>
    </form>
  );
}

export type FormerMember = { id: string; name: string; lastProduction: string; hasEmail: boolean };

const OUTCOME_LABELS = {
  sent: "Mail verschickt",
  "link-only": "Kein Mailversand eingerichtet – Link weitergeben",
  "no-email": "Keine E-Mail-Adresse – Link weitergeben",
  failed: "Mail fehlgeschlagen – Link weitergeben",
} as const;

const INITIAL_INVITE_STATE: InviteFormerMembersResult = { ok: false, error: "" };

export function InviteFormerMembersForm({
  showId,
  formerMembers,
}: {
  showId: string;
  formerMembers: FormerMember[];
}) {
  const action = useCallback(
    async (_state: InviteFormerMembersResult, formData: FormData) =>
      inviteFormerMembersAction(formData),
    [],
  );
  const [state, formAction, isPending] = useActionState(action, INITIAL_INVITE_STATE);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
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
    toast.success(state.message);
  }, [state]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Eingeladene verschwinden nach dem Neuladen aus der Liste und damit aus der Auswahl.
  const selectedIds = formerMembers
    .filter((member) => selected.has(member.id))
    .map((member) => member.id);
  const allSelected = formerMembers.length > 0 && selectedIds.length === formerMembers.length;

  return (
    <div className="space-y-4">
      {formerMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Alle Mitglieder früherer Produktionen sind bereits in dieser Produktion.
        </p>
      ) : (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="showId" value={showId} />
          {selectedIds.map((id) => (
            <input key={id} type="hidden" name="userIds" value={id} />
          ))}
          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              id="former-select-all"
              checked={allSelected}
              onCheckedChange={() =>
                setSelected(
                  allSelected ? new Set() : new Set(formerMembers.map((member) => member.id)),
                )
              }
            />
            <label htmlFor="former-select-all" className="font-medium">
              Alle auswählen ({formerMembers.length})
            </label>
          </div>
          <ul className="max-h-80 space-y-2 overflow-y-auto rounded-md border border-border p-3">
            {formerMembers.map((member) => {
              const id = `former-${member.id}`;
              return (
                <li key={member.id} className="flex items-center gap-3 text-sm">
                  <Checkbox
                    id={id}
                    checked={selected.has(member.id)}
                    onCheckedChange={() => toggle(member.id)}
                  />
                  <label htmlFor={id}>
                    {member.name}
                    <span className="text-muted-foreground">
                      {" "}
                      · zuletzt: {member.lastProduction}
                      {member.hasEmail ? "" : " · keine E-Mail"}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <Button type="submit" size="sm" disabled={isPending || selectedIds.length === 0}>
            {selectedIds.length} Personen einladen
          </Button>
        </form>
      )}

      {state.ok && state.outcomes.some((outcome) => outcome.link) ? (
        <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium">Persönliche Links (je einmal nutzbar, 30 Tage gültig)</p>
          <ul className="space-y-2">
            {state.outcomes
              .filter((outcome) => outcome.link)
              .map((outcome) => (
                <li key={outcome.userId} className="space-y-1">
                  <div>
                    {outcome.name} – {OUTCOME_LABELS[outcome.status]}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="break-all rounded bg-background px-2 py-1 text-xs">
                      {outcome.link}
                    </code>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(outcome.link ?? "")
                          .then(() => toast.success("Link kopiert"))
                          .catch((error: unknown) => {
                            console.error("[ensemble] Kopieren fehlgeschlagen", error);
                            toast.error("Kopieren fehlgeschlagen");
                          });
                      }}
                    >
                      Kopieren
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
