"use client";

import type { ComponentProps } from "react";
import { useEffect, useMemo, useState } from "react";

import { SearchIcon } from "@/components/ui/action-icons";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS, type Role } from "@/lib/roles";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

export interface DirectoryMember {
  id: string;
  email: string;
  name: string;
  roles: Role[];
}

const ROLE_BADGE_VARIANTS: Record<Role, BadgeVariant> = {
  member: "muted",
  cast: "default",
  tech: "info",
  board: "success",
  finance: "warning",
  admin: "destructive",
  owner: "secondary",
};

function getInitial(name: string) {
  return name.trim().charAt(0).toLocaleUpperCase("de-DE") || "?";
}

export function MemberDirectoryClient({ members }: { members: DirectoryMember[] }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const filteredMembers = useMemo(() => {
    const normalizedSearch = debouncedSearch.trim().toLocaleLowerCase("de-DE");
    if (!normalizedSearch) return members;

    return members.filter((member) => {
      const name = member.name.toLocaleLowerCase("de-DE");
      const email = member.email.toLocaleLowerCase("de-DE");
      return name.includes(normalizedSearch) || email.includes(normalizedSearch);
    });
  }, [debouncedSearch, members]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Mitglieder suchen"
          className="pl-10"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Mitglieder suchen..."
          type="search"
          value={search}
        />
      </div>

      {filteredMembers.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filteredMembers.map((member) => (
            <Card key={member.id} className="flex min-w-0 flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground">
                {getInitial(member.name)}
              </div>
              <div className="min-w-0 space-y-2">
                <h2 className="truncate text-sm font-semibold text-foreground">{member.name}</h2>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {member.roles.map((role) => (
                    <Badge key={role} variant={ROLE_BADGE_VARIANTS[role]} size="sm">
                      {ROLE_LABELS[role] ?? role}
                    </Badge>
                  ))}
                </div>
                <p className="truncate text-xs text-muted-foreground">{member.email}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <SearchIcon className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Keine Mitglieder für diese Suche gefunden.</p>
        </div>
      )}
    </div>
  );
}
