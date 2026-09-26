import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import { CalendarIcon, EditIcon, MapPinIcon } from "@/components/ui/action-icons";
import { resolveTeamsViewer } from "@/lib/departments/access";
import {
  BREAKDOWN_STATUS_LABELS,
  canViewRole,
  CASTING_TYPE_LABELS,
  loadRolePortal,
} from "@/lib/departments/roles";
import { cn } from "@/lib/utils";

import { ColorDot, formatEventDate, Initials, tint, ViewSwitcher } from "../../team-ui";
import { RoleNotes } from "./role-notes";

type View = "uebersicht" | "szenen" | "ausstattung";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ansicht?: string }>;
};

export default async function RollenPortalPage({ params, searchParams }: PageProps) {
  const [{ id }, { ansicht }] = await Promise.all([params, searchParams]);
  const { userId, isManager, production } = await resolveTeamsViewer();
  if (!userId || !production) notFound();
  if (!(await canViewRole(userId, production.id, isManager))) notFound();

  const role = await loadRolePortal(production.id, id, userId);
  if (!role) notFound();

  const view: View = ansicht === "szenen" || ansicht === "ausstattung" ? ansicht : "uebersicht";
  const basePath = `/mitglieder/meine-gewerke/rolle/${encodeURIComponent(role.id)}`;
  const openItems = role.breakdown.filter((item) => item.status !== "done").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={role.name}
        breadcrumbs={[{ id: "teams", label: "Meine Teams", href: "/mitglieder/meine-gewerke" }]}
      />

      <section
        className="overflow-hidden rounded-2xl border border-border bg-card"
        style={{
          backgroundImage: `linear-gradient(135deg, ${tint(role.color, 32)}, transparent 75%)`,
        }}
        aria-label={role.name}
      >
        <div className="flex items-start gap-3 p-4">
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold"
            style={{ backgroundColor: tint(role.color, 50) }}
          >
            {role.name.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Rolle
            </p>
            <h2 className="truncate text-lg font-semibold leading-tight">{role.name}</h2>
            {role.description ? (
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{role.description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-3 border-t border-border/60 px-4 py-1.5 text-xs text-muted-foreground">
          <span>
            {role.scenes.length} {role.scenes.length === 1 ? "Szene" : "Szenen"} · Du:{" "}
            {role.myCasting ? CASTING_TYPE_LABELS[role.myCasting] : "Einblick"}
          </span>
          {isManager ? (
            <Link
              href={`/mitglieder/produktionen/stueck?ansicht=rollen&rolle=${encodeURIComponent(role.id)}`}
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              <EditIcon className="h-3.5 w-3.5" aria-hidden />
              Bearbeiten
            </Link>
          ) : null}
        </div>
      </section>

      <ViewSwitcher<View>
        basePath={basePath}
        current={view}
        options={[
          { value: "uebersicht", label: "Überblick" },
          { value: "szenen", label: `Szenen ${role.scenes.length}` },
          { value: "ausstattung", label: `Ausstattung ${openItems}` },
        ]}
      />

      {view === "uebersicht" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Besetzung">
            {role.cast.length ? (
              <ul className="divide-y divide-border/60">
                {role.cast.map((person) => (
                  <li
                    key={`${person.id}-${person.type}`}
                    className="flex min-h-11 items-center gap-3 py-1.5"
                  >
                    <Initials initials={person.initials} className="h-8 w-8" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {person.name}
                        {person.id === userId ? " (du)" : ""}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {CASTING_TYPE_LABELS[person.type]}
                        {person.notes ? ` · ${person.notes}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Noch nicht besetzt.</Empty>
            )}
          </Section>

          <Section title="Nächste Proben der Besetzung">
            {role.rehearsals.length ? (
              <ul className="divide-y divide-border/60">
                {role.rehearsals.map((rehearsal) => (
                  <li key={rehearsal.id}>
                    <Link
                      href={`/mitglieder/proben/${rehearsal.id}`}
                      className="flex min-h-12 items-center gap-3 py-2 hover:text-primary"
                    >
                      <CalendarIcon className="h-4 w-4 shrink-0 text-info" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {rehearsal.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {formatEventDate(rehearsal.start)}
                          {role.cast.length > 1 ? ` · ${rehearsal.castInvited.join(", ")}` : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Keine Proben mit der Besetzung geplant.</Empty>
            )}
          </Section>

          <Section title="Notizen zur Rolle" className="lg:col-span-2">
            <RoleNotes
              characterId={role.id}
              notes={role.notes}
              canEdit={isManager || role.myCasting !== null}
            />
          </Section>
        </div>
      ) : null}

      {view === "szenen" ? (
        role.scenes.length ? (
          <ol className="grid gap-2 lg:grid-cols-2">
            {role.scenes.map((scene) => (
              <li key={scene.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg bg-muted px-2 text-sm font-semibold tabular-nums">
                    {scene.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <span className="truncate">{scene.title ?? scene.label}</span>
                      {scene.featured ? (
                        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                          Hauptszene
                        </span>
                      ) : null}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      {scene.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPinIcon className="h-3 w-3" aria-hidden />
                          {scene.location}
                        </span>
                      ) : null}
                      {scene.timeOfDay ? <span>{scene.timeOfDay}</span> : null}
                      {scene.durationMinutes ? <span>{scene.durationMinutes} Min.</span> : null}
                    </p>
                    <p className="mt-1 text-xs">
                      {scene.partners.length ? (
                        <>
                          <span className="text-muted-foreground">Mit: </span>
                          {scene.partners.join(", ")}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Allein auf der Bühne</span>
                      )}
                    </p>
                    {scene.note ? (
                      <p className="mt-1 text-xs text-muted-foreground">{scene.note}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>Die Rolle ist noch keiner Szene zugeordnet.</Empty>
        )
      ) : null}

      {view === "ausstattung" ? (
        role.breakdown.length ? (
          <ul className="divide-y divide-border/60 rounded-xl border border-border bg-card">
            {role.breakdown.map((item) => (
              <li key={item.id} className="flex min-h-12 items-center gap-3 px-3 py-2">
                <ColorDot color={item.department.color} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.department.name} · {item.scene}
                    {item.note ? ` · ${item.note}` : ""}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    item.status === "done" || item.status === "ready"
                      ? "bg-success/15 text-success"
                      : item.status === "blocked"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {BREAKDOWN_STATUS_LABELS[item.status]}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Für die Szenen der Rolle ist noch keine Ausstattung geplant.</Empty>
        )
      ) : null}
    </div>
  );
}

function Section({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "space-y-1 rounded-xl border border-border bg-card px-3 py-2.5 sm:px-4 sm:py-3",
        className,
      )}
    >
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
