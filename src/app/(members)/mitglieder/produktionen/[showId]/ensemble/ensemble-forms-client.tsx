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
  removeProductionMemberAction,
  updateProductionMemberAction,
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
