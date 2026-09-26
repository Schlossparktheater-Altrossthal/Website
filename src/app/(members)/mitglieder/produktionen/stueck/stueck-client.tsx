"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AlertTriangleIcon, PlusIcon, SearchIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import type { RolesScenesData, RsRole } from "@/lib/produktionen/roles-scenes";
import { getRoleSizeTitle } from "@/lib/produktionen/role-sizes";
import { cn } from "@/lib/utils";

import { AblaufView } from "./ablauf";
import { AuftritteView } from "./auftritte";
import { RolePanel, ScenePanel } from "./panels";
import { formatMinutes, inputClass, RoleRow } from "./ui";

export type StueckView = "ablauf" | "rollen" | "auftritte";

const BASE_PATH = "/mitglieder/produktionen/stueck";

const VIEW_LABELS: Record<StueckView, string> = {
  ablauf: "Ablauf",
  rollen: "Rollen",
  auftritte: "Auftritte",
};

export function StueckClient({ data, view }: { data: RolesScenesData; view: StueckView }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState<
    { kind: "role" } | { kind: "scene"; act: number } | null
  >(null);

  const roleId = searchParams.get("rolle");
  const sceneId = searchParams.get("szene");
  const openRole = data.roles.find((role) => role.id === roleId) ?? null;
  const openScene = data.scenes.find((scene) => scene.id === sceneId) ?? null;

  // Offene Rolle/Szene steht in der URL, damit Links aus Portal und Zuweisung direkt öffnen.
  const navigate = (params: Record<string, string | null>) => {
    const next = new URLSearchParams();
    if (view !== "ablauf") next.set("ansicht", view);
    for (const [key, value] of Object.entries(params)) if (value) next.set(key, value);
    const search = next.toString();
    router.replace(search ? `${BASE_PATH}?${search}` : BASE_PATH, { scroll: false });
  };

  const needle = query.trim().toLowerCase();
  const scenes = data.scenes.filter(
    (scene) =>
      !needle ||
      [scene.identifier, scene.title, scene.location].some((value) =>
        value?.toLowerCase().includes(needle),
      ) ||
      scene.roles.some((entry) =>
        data.roles
          .find((role) => role.id === entry.characterId)
          ?.name.toLowerCase()
          .includes(needle),
      ),
  );
  const roles = data.roles.filter(
    (role) =>
      !needle ||
      role.name.toLowerCase().includes(needle) ||
      role.cast.some((entry) => entry.person.name.toLowerCase().includes(needle)),
  );

  return (
    <div className="space-y-4">
      <nav
        aria-label="Ansicht"
        className="flex w-full gap-0.5 rounded-lg bg-muted/70 p-0.5 sm:inline-flex sm:w-auto"
      >
        {(Object.keys(VIEW_LABELS) as StueckView[]).map((key) => (
          <Link
            key={key}
            href={key === "ablauf" ? BASE_PATH : `${BASE_PATH}?ansicht=${key}`}
            aria-current={key === view ? "page" : undefined}
            scroll={false}
            className={cn(
              "inline-flex h-10 flex-1 items-center justify-center rounded-md px-4 text-sm font-medium sm:flex-none",
              key === view
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {VIEW_LABELS[key]}
            {key === "ablauf"
              ? ` ${data.scenes.length}`
              : key === "rollen"
                ? ` ${data.roles.length}`
                : ""}
          </Link>
        ))}
      </nav>

      {view !== "auftritte" ? (
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Suchen</span>
            <SearchIcon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              className={cn(inputClass, "pl-9")}
              value={query}
              placeholder={
                view === "rollen" ? "Rolle oder Person suchen" : "Szene, Ort oder Rolle suchen"
              }
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <Button
            type="button"
            className="h-11 shrink-0"
            onClick={() =>
              setCreating(
                view === "rollen"
                  ? { kind: "role" }
                  : { kind: "scene", act: data.acts.at(-1)?.number ?? 1 },
              )
            }
          >
            <PlusIcon className="h-4 w-4" aria-hidden />
            {view === "rollen" ? "Rolle" : "Szene"}
          </Button>
        </div>
      ) : null}

      {view === "ablauf" ? (
        data.scenes.length ? (
          <AblaufView
            data={data}
            scenes={scenes}
            onOpenScene={(id) => navigate({ szene: id })}
            onNewScene={(act) => setCreating({ kind: "scene", act })}
          />
        ) : (
          <Empty
            text="Noch keine Szenen. Lege die erste Szene an – Akte und Nummern ergeben sich von selbst."
            action="Erste Szene anlegen"
            onAction={() => setCreating({ kind: "scene", act: 1 })}
          />
        )
      ) : null}

      {view === "rollen" ? (
        data.roles.length ? (
          <RolesView data={data} roles={roles} onOpen={(id) => navigate({ rolle: id })} />
        ) : (
          <Empty
            text="Noch keine Rollen angelegt."
            action="Erste Rolle anlegen"
            onAction={() => setCreating({ kind: "role" })}
          />
        )
      ) : null}

      {view === "auftritte" ? <AuftritteView data={data} /> : null}

      <RolePanel
        key={openRole?.id ?? (creating?.kind === "role" ? "new" : "closed")}
        open={creating?.kind === "role" || openRole !== null}
        role={openRole}
        data={data}
        onClose={() => {
          setCreating(null);
          if (roleId) navigate({});
        }}
        onCreated={(id) => {
          setCreating(null);
          navigate({ rolle: id });
        }}
      />
      <ScenePanel
        key={openScene?.id ?? (creating?.kind === "scene" ? `new-${creating.act}` : "closed")}
        open={creating?.kind === "scene" || openScene !== null}
        scene={openScene}
        defaultAct={creating?.kind === "scene" ? creating.act : 1}
        data={data}
        onClose={() => {
          setCreating(null);
          if (sceneId) navigate({});
        }}
        onCreated={(id) => {
          setCreating(null);
          navigate({ szene: id });
        }}
      />
    </div>
  );
}

function Empty({ text, action, onAction }: { text: string; action: string; onAction: () => void }) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Button type="button" variant="outline" className="mt-3 h-10" onClick={onAction}>
        {action}
      </Button>
    </div>
  );
}

function RolesView({
  data,
  roles,
  onOpen,
}: {
  data: RolesScenesData;
  roles: RsRole[];
  onOpen: (id: string) => void;
}) {
  const stats = (role: RsRole) => {
    const scenes = data.scenes.filter((scene) => role.sceneIds.includes(scene.id));
    const minutes = scenes.reduce((sum, scene) => sum + (scene.durationMinutes ?? 0), 0);
    return {
      scenes,
      minutes,
      range:
        scenes.length > 1
          ? `${scenes[0].identifier}–${scenes.at(-1)?.identifier}`
          : (scenes[0]?.identifier ?? null),
    };
  };
  const uncast = roles.filter((role) => !role.cast.some((entry) => entry.type === "primary"));
  const cast = roles.filter((role) => role.cast.some((entry) => entry.type === "primary"));

  const renderRow = (role: RsRole) => {
    const { scenes, minutes, range } = stats(role);
    const size = getRoleSizeTitle(role.size);
    return (
      <RoleRow
        key={role.id}
        role={role}
        onOpen={() => onOpen(role.id)}
        meta={
          <>
            <span className="block">
              {scenes.length} {scenes.length === 1 ? "Szene" : "Szenen"}
              {minutes ? ` · ${formatMinutes(minutes)}` : ""}
            </span>
            <span className="block">{[size, range].filter(Boolean).join(" · ")}</span>
          </>
        }
      />
    );
  };

  return (
    <div className="space-y-4">
      {uncast.length ? (
        <section className="space-y-2" aria-labelledby="uncast-heading">
          <h2
            id="uncast-heading"
            className="flex items-center gap-1.5 text-sm font-semibold text-destructive"
          >
            <AlertTriangleIcon className="h-4 w-4" aria-hidden />
            Noch nicht besetzt ({uncast.length})
          </h2>
          <ul className="grid gap-2 lg:grid-cols-2">{uncast.map(renderRow)}</ul>
        </section>
      ) : null}
      {cast.length ? (
        <section className="space-y-2" aria-labelledby="cast-heading">
          {uncast.length ? (
            <h2 id="cast-heading" className="text-sm font-semibold">
              Besetzt ({cast.length})
            </h2>
          ) : null}
          <ul className="grid gap-2 lg:grid-cols-2">{cast.map(renderRow)}</ul>
        </section>
      ) : null}
      {!roles.length ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Keine Treffer.</p>
      ) : null}
    </div>
  );
}
