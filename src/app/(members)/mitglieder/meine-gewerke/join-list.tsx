"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AsyncButton } from "@/components/ui/async-button";
import type { JoinableTeam } from "@/lib/departments/portal";

import { joinDepartmentAction, withdrawJoinRequestAction } from "./actions";
import { ColorDot } from "./team-ui";

/** Weitere Gewerke der Produktion: beitreten, Anfrage stellen oder zurückziehen. */
export function JoinList({ teams }: { teams: JoinableTeam[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  const run = async (team: JoinableTeam) => {
    setBusy(team.id);
    const result = team.requested
      ? await withdrawJoinRequestAction({ departmentId: team.id })
      : await joinDepartmentAction({ departmentId: team.id });
    setBusy(null);
    if (!result.ok) {
      toast.error("Das hat nicht geklappt", { description: result.error, duration: 5000 });
      return;
    }
    if (result.message) toast.success(result.message, { duration: 3000 });
    router.refresh();
  };

  return (
    <ul className="divide-y divide-border/60 rounded-xl border border-border bg-card">
      {teams.map((team) => (
        <li key={team.id} className="flex min-h-14 items-center gap-3 px-3 py-2">
          <ColorDot color={team.color} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{team.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {team.requested
                ? "Anfrage gestellt – die Leitung entscheidet"
                : (team.description ??
                  (team.requiresJoinApproval ? "Beitritt nach Anfrage" : "Offen für alle"))}
            </span>
          </span>
          <AsyncButton
            type="button"
            size="sm"
            variant={team.requested ? "ghost" : "outline"}
            className="h-10 shrink-0"
            isLoading={busy === team.id}
            onClick={() => void run(team)}
          >
            {team.requested ? "Zurückziehen" : team.requiresJoinApproval ? "Anfragen" : "Beitreten"}
          </AsyncButton>
        </li>
      ))}
    </ul>
  );
}
