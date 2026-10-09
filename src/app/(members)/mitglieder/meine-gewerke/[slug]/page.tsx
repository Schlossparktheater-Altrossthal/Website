import Link from "next/link";
import { notFound } from "next/navigation";

import { MemberMeasurementsControlCenter } from "@/components/members/measurements/member-measurements-control-center";
import { SizeTable } from "@/components/members/measurements/size-table";
import { PageHeader } from "@/components/members/page-header";
import { DeadlineBadge } from "@/components/production/deadline-badge";
import { UserAvatar } from "@/components/user-avatar";
import {
  AlertTriangleIcon,
  CalendarIcon,
  ChevronRightIcon,
  ListTodoIcon,
} from "@/components/ui/action-icons";
import { KINDS_FOR_MODULE } from "@/lib/ausstattung/constants";
import {
  loadDepartmentObjects,
  loadInbox,
  loadShowObjects,
  loadStage,
} from "@/lib/ausstattung/objects";
import { resolveTeamsViewer } from "@/lib/departments/access";
import { loadBoard, type BoardTask } from "@/lib/departments/board";
import {
  canEditNotes,
  type HandoverSettings,
  loadHandoverSettings,
  loadNotices,
  loadSinceLastVisit,
  touchDepartmentVisit,
} from "@/lib/departments/handover";
import { loadTeamEvents } from "@/lib/departments/events";
import { loadDepartmentPortal, type PortalMember } from "@/lib/departments/portal";
import { castOfShow, loadMeasurementMembers } from "@/lib/measurements/members";
import { cn } from "@/lib/utils";

import { CostumePlot } from "../ausstattung/costume-views";
import { RequirementInbox } from "../ausstattung/inbox";
import { ObjectListView } from "../ausstattung/object-list";
import { PropsCheck, PropsRunsheet } from "../ausstattung/props-views";
import { SetByScene, SetChangeovers } from "../ausstattung/set-views";
import { SubViews } from "../ausstattung/shared";
import { DepartmentBoard } from "../board/board";
import { DepartmentSettingsButton } from "../department-settings-panel";
import { VorOrt, type WorkItem } from "../handover/overview";
import type { WorkPermissions } from "../handover/task-work";
import { TeamEvents } from "../events/team-events";
import { TeamFiles } from "../files/team-files";
import { formatDue, formatEventDate, TEAM_ROLE_LABELS, tint, ViewSwitcher } from "../team-ui";

type View =
  | "uebersicht"
  | "aufgaben"
  | "requisiten"
  | "kostueme"
  | "buehnenbild"
  | "termine"
  | "masse"
  | "team";

/** Verwaltungsseiten der Ausstattung je Baustein (docs/Plan/ausstattung-plan.md). */
const OBJECT_VIEWS = [
  { view: "requisiten", module: "props", label: "Requisiten" },
  { view: "kostueme", module: "costumes", label: "Kostüme" },
  { view: "buehnenbild", module: "set", label: "Bühnenbild" },
] as const;

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    ansicht?: string;
    teil?: string;
    karte?: string;
    neu?: string;
    meilenstein?: string;
  }>;
};

export default async function GewerkPortalPage({ params, searchParams }: PageProps) {
  const [{ slug }, { ansicht, teil, karte, neu, meilenstein }] = await Promise.all([
    params,
    searchParams,
  ]);
  const { userId, isManager, production } = await resolveTeamsViewer();
  if (!userId || !production) notFound();

  const portal = await loadDepartmentPortal(production.id, decodeURIComponent(slug), userId);
  // Sichtbar für Mitglieder des Gewerks sowie Regie/Board.
  if (!portal || (!portal.viewerRole && !isManager)) notFound();

  const hasMeasurements = portal.modules.includes("measurements");
  const objectViews = OBJECT_VIEWS.filter((entry) => portal.modules.includes(entry.module));
  const hasInbox = portal.modules.includes("requirements");
  const objectView = objectViews.find((entry) => entry.view === ansicht)?.view;
  const view: View = objectView
    ? objectView
    : ansicht === "aufgaben" ||
        ansicht === "termine" ||
        ansicht === "team" ||
        (ansicht === "masse" && hasMeasurements)
      ? ansicht
      : "uebersicht";
  const basePath = `/mitglieder/meine-gewerke/${encodeURIComponent(portal.slug)}`;
  const canManage = isManager || portal.viewerRole === "lead";
  const boardEdit = isManager || (portal.viewerRole !== null && portal.viewerRole !== "guest");
  const boardManage = isManager || portal.viewerRole === "lead" || portal.viewerRole === "deputy";
  // Übergabe (docs/Plan/uebergabe-plan.md): Besuch merken, Bezugspunkt für „neu“.
  const [since, handoverSettings] = await Promise.all([
    portal.viewerRole ? touchDepartmentVisit(portal.id, userId) : Promise.resolve(null),
    loadHandoverSettings(portal.id),
  ]);
  const notesEditable = canEditNotes(
    { canEdit: boardEdit, canManage: boardManage },
    handoverSettings.noteEditors,
  );
  const leads = portal.members.filter((member) => member.role === "lead");

  // Eigene offene Aufgaben und Termine in einer Zeitleiste: Überfälliges zuerst, ohne Frist ans Ende.
  const timeline = [
    ...portal.myTasks.map((task) => ({
      key: `task-${task.id}`,
      kind: "task" as const,
      title: task.title,
      at: task.dueAt,
      overdue: task.overdue,
      when: task.overdue
        ? "überfällig"
        : task.dueAt
          ? `${formatDue(task.dueAt)}${task.inherited ? " · Meilenstein" : ""}`
          : "ohne Frist",
      detail: task.status === "doing" ? "In Arbeit" : null,
    })),
    // Abgesagte Termine blenden wir aus, offene Antworten fallen auf.
    ...portal.events
      .filter((event) => event.myResponse !== "no")
      .slice(0, 5)
      .map((event) => ({
        key: `event-${event.id}`,
        kind: "event" as const,
        title: event.title,
        at: event.start,
        overdue: false,
        when: formatEventDate(event.start),
        detail:
          [
            event.location,
            portal.viewerRole && !event.myResponse ? "Antwort offen" : null,
            event.myResponse === "maybe" ? "Vielleicht" : null,
          ]
            .filter(Boolean)
            .join(" · ") || null,
      })),
  ].sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      (a.at?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.at?.getTime() ?? Number.MAX_SAFE_INTEGER),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={portal.name}
        breadcrumbs={[{ id: "teams", label: "Meine Teams", href: "/mitglieder/meine-gewerke" }]}
      />

      <section
        className="overflow-hidden rounded-2xl border border-border bg-card"
        style={{
          backgroundImage: `linear-gradient(135deg, ${tint(portal.color, 32)}, transparent 75%)`,
        }}
        aria-label={portal.name}
      >
        <div className="flex items-start gap-3 p-4">
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
            style={{ backgroundColor: tint(portal.color, 50) }}
          >
            {portal.name.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold leading-tight">{portal.name}</h2>
            <p className="truncate text-sm text-muted-foreground">
              {leads.length
                ? `Leitung: ${leads.map((member) => member.name).join(", ")}`
                : "Leitung noch offen"}
            </p>
            {portal.description ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {portal.description}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-2.5">
          <Link href={`${basePath}?ansicht=team`} className="flex min-h-9 items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {portal.members.length} {portal.members.length === 1 ? "Person" : "Personen"} · Du:{" "}
              {portal.viewerRole ? TEAM_ROLE_LABELS[portal.viewerRole] : "Einblick als Regie"}
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {isManager ? (
              <DepartmentSettingsButton
                showId={production.id}
                department={{
                  id: portal.id,
                  name: portal.name,
                  description: portal.description,
                  color: portal.color,
                  requiresJoinApproval: portal.requiresJoinApproval,
                }}
              />
            ) : null}
            {canManage && portal.requests.length ? (
              <Link
                href={`${basePath}?ansicht=team`}
                className="rounded-full bg-warning px-2.5 py-1 text-xs font-semibold text-warning-foreground"
              >
                {portal.requests.length} {portal.requests.length === 1 ? "Anfrage" : "Anfragen"}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <ViewSwitcher<View>
        basePath={basePath}
        current={view}
        options={[
          { value: "uebersicht", label: "Vor Ort" },
          { value: "aufgaben", label: `Aufgaben ${portal.openTasks.length}` },
          ...objectViews.map((entry) => ({ value: entry.view as View, label: entry.label })),
          { value: "termine", label: `Termine ${portal.events.length}` },
          ...(hasMeasurements ? [{ value: "masse" as const, label: "Maße" }] : []),
          { value: "team", label: `Team ${portal.members.length}` },
        ]}
      />

      {view === "uebersicht" ? (
        <VorOrtSection
          departmentId={portal.id}
          basePath={basePath}
          viewerId={userId}
          since={since}
          settings={handoverSettings}
          perms={{
            viewerId: userId,
            canEdit: boardEdit,
            canManage: boardManage,
            canEditCaution: notesEditable,
            stepUndo: handoverSettings.stepUndo,
          }}
        />
      ) : null}

      {view === "uebersicht" ? (
        <section className="space-y-2" aria-labelledby="next-heading">
          <div className="flex items-center justify-between">
            <h2 id="next-heading" className="text-sm font-semibold">
              Deine Termine & Aufgaben
            </h2>
            <span className="text-xs text-muted-foreground">
              {portal.taskCounts.todo + portal.taskCounts.doing} offen · {portal.taskCounts.done}{" "}
              erledigt
            </span>
          </div>
          {portal.nextMilestone?.dueAt ? (
            <Link
              href="/mitglieder/produktionen"
              className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 transition-colors hover:bg-primary/10"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">Nächste Frist im Plan</span>
                <span className="block truncate text-sm font-medium">
                  {portal.nextMilestone.title}
                </span>
                {portal.nextMilestone.tasksTotal ? (
                  <span className="block text-xs text-muted-foreground">
                    {portal.nextMilestone.tasksDone}/{portal.nextMilestone.tasksTotal} Karten
                  </span>
                ) : null}
              </span>
              <DeadlineBadge dueAt={portal.nextMilestone.dueAt} />
            </Link>
          ) : null}
          {timeline.length ? (
            <ol className="relative space-y-2 before:absolute before:bottom-3 before:left-[1.1rem] before:top-3 before:w-px before:bg-border">
              {timeline.map((item) => (
                <li key={item.key} className="relative flex items-center gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-background",
                      item.kind === "event"
                        ? "bg-info/15 text-info"
                        : item.overdue
                          ? "bg-destructive/15 text-destructive"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {item.kind === "event" ? (
                      <CalendarIcon className="h-4 w-4" />
                    ) : item.overdue ? (
                      <AlertTriangleIcon className="h-4 w-4" />
                    ) : (
                      <ListTodoIcon className="h-4 w-4" />
                    )}
                  </span>
                  <Link
                    href={`${basePath}?ansicht=${item.kind === "event" ? "termine" : "aufgaben"}`}
                    className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 transition-colors hover:bg-muted/40"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{item.title}</span>
                      <span
                        className={cn(
                          "shrink-0 text-xs",
                          item.overdue ? "font-medium text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {item.when}
                      </span>
                    </span>
                    {item.detail ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.detail}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>Gerade steht nichts an – keine Aufgaben für dich und keine Termine.</Empty>
          )}
        </section>
      ) : null}

      {view === "aufgaben" && hasInbox ? (
        <InboxSection
          departmentId={portal.id}
          basePath={basePath}
          canEdit={isManager || (portal.viewerRole !== null && portal.viewerRole !== "guest")}
        />
      ) : null}

      {objectViews.some((entry) => entry.view === view) ? (
        <ObjectSection
          view={view as (typeof OBJECT_VIEWS)[number]["view"]}
          part={teil ?? null}
          showId={production.id}
          departmentId={portal.id}
          basePath={basePath}
          canEdit={isManager || (portal.viewerRole !== null && portal.viewerRole !== "guest")}
        />
      ) : null}

      {view === "aufgaben" ? (
        <DepartmentBoard
          data={await loadBoard(portal.id, {
            viewerId: userId,
            since,
            canEditNotes: notesEditable,
            stepUndo: handoverSettings.stepUndo,
          })}
          viewerId={userId}
          canEdit={boardEdit}
          canManage={boardManage}
          initialTaskId={karte ?? null}
          newForMilestoneId={neu === "1" ? (meilenstein ?? null) : null}
          basePath={basePath}
        />
      ) : null}

      {view === "termine" ? (
        <TeamEvents
          data={await loadTeamEvents(portal.id, userId)}
          canRespond={portal.viewerRole !== null}
          canManage={isManager || portal.viewerRole === "lead" || portal.viewerRole === "deputy"}
        />
      ) : null}

      {view === "masse" ? (
        <MeasurementsView
          showId={production.id}
          canConfigure={isManager || (portal.viewerRole !== null && portal.viewerRole !== "guest")}
        />
      ) : null}

      {view === "team" ? (
        <div className="space-y-4">
          {canManage && portal.requests.length ? (
            <Section
              title={`Anfragen (${portal.requests.length})`}
              action={{ href: "/mitglieder/produktionen/zuweisung", label: "Entscheiden" }}
            >
              <ul className="divide-y divide-border">
                {portal.requests.map((member) => (
                  <MemberRow key={member.id} member={member} hint="möchte mitmachen" />
                ))}
              </ul>
            </Section>
          ) : null}
          <Section
            title="Mitglieder"
            action={
              canManage
                ? { href: "/mitglieder/produktionen/zuweisung", label: "Personen zuweisen" }
                : undefined
            }
          >
            {portal.members.length ? (
              <ul className="divide-y divide-border sm:grid sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
                {portal.members.map((member) => (
                  <MemberRow key={member.id} member={member} showMail={canManage} />
                ))}
              </ul>
            ) : (
              <Empty>Noch niemand zugewiesen.</Empty>
            )}
          </Section>
          <Section title={`Dateien (${portal.files.length})`}>
            <TeamFiles
              departmentId={portal.id}
              files={portal.files}
              viewerId={userId}
              canUpload={isManager || (portal.viewerRole !== null && portal.viewerRole !== "guest")}
              canManage={
                isManager || portal.viewerRole === "lead" || portal.viewerRole === "deputy"
              }
            />
          </Section>
        </div>
      ) : null}
    </div>
  );
}

/** „Gerade dran“: in Arbeit, jemand ist dran, Achtung oder neu – das Eigene zuerst. */
async function VorOrtSection({
  departmentId,
  basePath,
  viewerId,
  since,
  settings,
  perms,
}: {
  departmentId: string;
  basePath: string;
  viewerId: string;
  since: Date | null;
  settings: HandoverSettings;
  perms: WorkPermissions;
}) {
  const [board, notices, news] = await Promise.all([
    loadBoard(departmentId, { viewerId, since }),
    loadNotices(departmentId),
    loadSinceLastVisit(departmentId, viewerId, since),
  ]);
  const rank = (task: BoardTask) =>
    task.handover.claim?.userId === viewerId
      ? 0
      : task.handover.claim
        ? 1
        : task.handover.caution
          ? 2
          : task.work.status === "doing"
            ? 3
            : 4;
  const items: WorkItem[] = board.columns
    .flatMap((column) => column.tasks)
    .filter(
      (task) =>
        task.work.status !== "done" &&
        (task.work.status === "doing" ||
          task.handover.claim ||
          task.handover.caution ||
          task.hasNews),
    )
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, 12)
    .map((task) => ({ id: task.id, title: task.title, work: task.work, hasNews: task.hasNews }));
  return (
    <VorOrt
      departmentId={departmentId}
      basePath={basePath}
      firstColumnId={
        board.columns.find((column) => column.status === "todo")?.id ?? board.columns[0]?.id ?? null
      }
      notices={notices}
      news={news}
      settings={settings}
      items={items}
      perms={perms}
      canEditNotes={perms.canEditCaution}
    />
  );
}

async function InboxSection({
  departmentId,
  basePath,
  canEdit,
}: {
  departmentId: string;
  basePath: string;
  canEdit: boolean;
}) {
  const [items, objects] = await Promise.all([
    loadInbox(departmentId),
    loadDepartmentObjects(departmentId),
  ]);
  return (
    <RequirementInbox
      items={items}
      objects={objects.map((object) => ({ id: object.id, title: object.title, kind: object.kind }))}
      basePath={basePath}
      canEdit={canEdit}
    />
  );
}

async function ObjectSection({
  view,
  part,
  showId,
  departmentId,
  basePath,
  canEdit,
}: {
  view: (typeof OBJECT_VIEWS)[number]["view"];
  part: string | null;
  showId: string;
  departmentId: string;
  basePath: string;
  canEdit: boolean;
}) {
  const moduleKey = OBJECT_VIEWS.find((entry) => entry.view === view)!.module;
  const kinds = KINDS_FOR_MODULE[moduleKey] ?? [];
  const [objects, stage] = await Promise.all([
    loadDepartmentObjects(departmentId, kinds),
    loadStage(showId),
  ]);

  if (view === "requisiten") {
    const current = part === "ablauf" || part === "check" ? part : "liste";
    return (
      <div className="space-y-3">
        <SubViews
          basePath={basePath}
          view={view}
          current={current}
          options={[
            { value: "liste", label: `Liste ${objects.length}` },
            { value: "ablauf", label: "Je Szene" },
            { value: "check", label: "Vorstellungs-Check" },
          ]}
        />
        {current === "liste" ? (
          <ObjectListView
            objects={objects}
            stage={stage}
            departmentId={departmentId}
            basePath={basePath}
            kinds={kinds}
            canEdit={canEdit}
            emptyText="Noch keine Requisiten. Lege sie hier an oder übernimm Anforderungen aus dem Eingang."
          />
        ) : current === "ablauf" ? (
          <PropsRunsheet objects={objects} stage={stage} basePath={basePath} />
        ) : (
          <PropsCheck
            objects={objects}
            stage={stage}
            departmentId={departmentId}
            canEdit={canEdit}
          />
        )}
      </div>
    );
  }

  if (view === "kostueme") {
    const current = part === "plot" ? part : "liste";
    // Der Plot zeigt alle Kostüme der Produktion, auch aus anderen Gewerken.
    const costumes = current === "plot" ? await loadShowObjects(showId, ["costume"]) : [];
    return (
      <div className="space-y-3">
        <SubViews
          basePath={basePath}
          view={view}
          current={current}
          options={[
            { value: "liste", label: `Kostüme & Teile ${objects.length}` },
            { value: "plot", label: "Kostümplot" },
          ]}
        />
        {current === "liste" ? (
          <ObjectListView
            objects={objects}
            stage={stage}
            departmentId={departmentId}
            basePath={basePath}
            kinds={kinds}
            canEdit={canEdit}
            emptyText="Noch keine Kostüme. Ein Kostüm stellst du aus Teilen zusammen."
          />
        ) : (
          <CostumePlot costumes={costumes} stage={stage} basePath={basePath} />
        )}
      </div>
    );
  }

  const current = part === "szenen" || part === "umbauten" ? part : "liste";
  return (
    <div className="space-y-3">
      <SubViews
        basePath={basePath}
        view={view}
        current={current}
        options={[
          { value: "liste", label: `Elemente ${objects.length}` },
          { value: "szenen", label: "Je Szene" },
          { value: "umbauten", label: "Umbauten" },
        ]}
      />
      {current === "liste" ? (
        <ObjectListView
          objects={objects}
          stage={stage}
          departmentId={departmentId}
          basePath={basePath}
          kinds={kinds}
          canEdit={canEdit}
          emptyText="Noch keine Bühnenbild-Elemente."
        />
      ) : current === "szenen" ? (
        <SetByScene objects={objects} stage={stage} basePath={basePath} />
      ) : (
        <SetChangeovers objects={objects} stage={stage} basePath={basePath} />
      )}
    </div>
  );
}

async function MeasurementsView({
  showId,
  canConfigure,
}: {
  showId: string;
  canConfigure: boolean;
}) {
  const members = await loadMeasurementMembers(castOfShow(showId));
  return (
    <div className="space-y-4">
      <MemberMeasurementsControlCenter members={members} canConfigureMeasurements={canConfigure} />
      <SizeTable members={members} />
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1 rounded-xl border border-border bg-card px-3 py-2.5 sm:px-4 sm:py-3">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action ? (
          <Link
            href={action.href}
            className="-mr-1 inline-flex min-h-10 items-center gap-0.5 px-1 text-sm font-medium text-primary hover:underline"
          >
            {action.label}
            <ChevronRightIcon className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-center text-sm text-muted-foreground">{children}</p>;
}

function MemberRow({
  member,
  hint,
  showMail,
}: {
  member: PortalMember;
  hint?: string;
  showMail?: boolean;
}) {
  return (
    <li className="flex min-h-11 items-center gap-3 py-1.5">
      <UserAvatar
        userId={member.id}
        name={member.name}
        email={member.email}
        avatarSource={member.avatarSource}
        avatarUpdatedAt={member.avatarUpdatedAt}
        size={32}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{member.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {hint ?? member.title ?? TEAM_ROLE_LABELS[member.role]}
        </span>
      </span>
      {showMail && member.email ? (
        <a
          href={`mailto:${member.email}`}
          className="shrink-0 text-xs text-primary hover:underline"
          aria-label={`E-Mail an ${member.name}`}
        >
          E-Mail
        </a>
      ) : null}
    </li>
  );
}
