import Link from "next/link";
import { DepartmentMembershipRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  createDepartmentAction,
  updateDepartmentAction,
  deleteDepartmentAction,
  addDepartmentMemberAction,
  updateDepartmentMemberAction,
  removeDepartmentMemberAction,
} from "../actions";

const ROLE_LABELS: Record<DepartmentMembershipRole, string> = {
  lead: "Leitung",
  member: "Mitglied",
  deputy: "Vertretung",
  guest: "Gast",
};

function formatUserName(user: { name: string | null; email: string | null }) {
  if (user.name && user.name.trim()) return user.name;
  if (user.email) return user.email;
  return "Unbekannt";
}

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function ProduktionsGewerkePage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.produktionen");
  if (!allowed) {
    return (
      <div className="rounded-lg border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
        Du hast keinen Zugriff auf die Produktionsplanung.
      </div>
    );
  }

  const [departments, users] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: "asc" },
      include: {
        memberships: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.user.findMany({
      orderBy: [
        { name: "asc" },
        { email: "asc" },
      ],
      select: { id: true, name: true, email: true },
    }),
  ]);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Team-Workspace</p>
            <h1 className="text-3xl font-semibold">Gewerke &amp; Zuständigkeiten</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Strukturiere dein Produktionsteam, vergib Verantwortlichkeiten und halte Kontaktdaten zentral an einem Ort fest.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/mitglieder/produktionen">Zur Produktionsübersicht</Link>
          </Button>
        </div>
      </section>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg font-semibold">Neues Gewerk anlegen</CardTitle>
          <p className="text-sm text-muted-foreground">
            Definiere Verantwortungsbereiche mit Farben, Beschreibungen und optionalem Slug für eine bessere Orientierung.
          </p>
        </CardHeader>
        <CardContent>
          <form action={createDepartmentAction} className="grid gap-4 md:grid-cols-2" method="post">
            <input type="hidden" name="redirectPath" value="/mitglieder/produktionen/gewerke" />
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input name="name" placeholder="z.B. Maske" required minLength={2} maxLength={80} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Slug (optional)</label>
              <Input name="slug" placeholder="maske" maxLength={80} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Farbe</label>
              <input
                type="color"
                name="color"
                defaultValue="#9333ea"
                className="h-10 w-full cursor-pointer rounded-md border border-input bg-background"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Beschreibung</label>
              <Textarea name="description" rows={2} maxLength={2000} placeholder="Kurzbeschreibung für das Gewerk" />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Gewerk speichern</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        {departments.map((department) => {
          const memberIds = new Set(department.memberships.map((membership) => membership.user.id));
          const availableUsers = users.filter((user) => !memberIds.has(user.id));

          return (
            <Card key={department.id} className="space-y-6">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1 inline-block h-3 w-3 rounded-full border border-border/80"
                      style={{ backgroundColor: department.color ?? "#94a3b8" }}
                    />
                    <div className="space-y-1">
                      <CardTitle className="text-xl font-semibold">{department.name}</CardTitle>
                      {department.description ? (
                        <p className="text-sm text-muted-foreground">{department.description}</p>
                      ) : null}
                      {department.slug ? (
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Slug: {department.slug}</p>
                      ) : null}
                    </div>
                  </div>
                  <form action={deleteDepartmentAction} method="post">
                    <input type="hidden" name="id" value={department.id} />
                    <input type="hidden" name="redirectPath" value="/mitglieder/produktionen/gewerke" />
                    <Button type="submit" variant="ghost" size="sm">
                      Entfernen
                    </Button>
                  </form>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <form
                  action={updateDepartmentAction}
                  method="post"
                  className="grid gap-3 rounded-lg border border-border/60 bg-background/70 p-4"
                >
                  <input type="hidden" name="id" value={department.id} />
                  <input type="hidden" name="redirectPath" value="/mitglieder/produktionen/gewerke" />
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</label>
                      <Input name="name" defaultValue={department.name} minLength={2} maxLength={80} required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Slug</label>
                      <Input name="slug" defaultValue={department.slug ?? ""} maxLength={80} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Farbe</label>
                      <input
                        type="color"
                        name="color"
                        defaultValue={department.color ?? "#94a3b8"}
                        className="h-10 w-full cursor-pointer rounded-md border border-input bg-background"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Beschreibung
                      </label>
                      <Textarea
                        name="description"
                        rows={2}
                        maxLength={2000}
                        defaultValue={department.description ?? ""}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" variant="outline" size="sm">
                      Gewerk aktualisieren
                    </Button>
                  </div>
                </form>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold">Teammitglieder</h3>
                    <p className="text-xs text-muted-foreground">
                      Verknüpfe Personen mit klaren Rollen und zusätzlichen Notizen.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {department.memberships.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Noch keine Mitglieder zugeordnet.</p>
                    ) : (
                      department.memberships.map((membership) => (
                        <div
                          key={membership.id}
                          className="rounded-lg border border-border/60 bg-background/80 p-3 text-sm shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium">{formatUserName(membership.user)}</p>
                              <p className="text-xs text-muted-foreground">{ROLE_LABELS[membership.role]}</p>
                              {membership.title ? (
                                <p className="text-xs text-muted-foreground">{membership.title}</p>
                              ) : null}
                              {membership.note ? (
                                <p className="text-xs text-muted-foreground">Notiz: {membership.note}</p>
                              ) : null}
                            </div>
                            <form action={removeDepartmentMemberAction} method="post">
                              <input type="hidden" name="membershipId" value={membership.id} />
                              <input type="hidden" name="redirectPath" value="/mitglieder/produktionen/gewerke" />
                              <Button type="submit" variant="ghost" size="sm">
                                Entfernen
                              </Button>
                            </form>
                          </div>
                          <form
                            action={updateDepartmentMemberAction}
                            method="post"
                            className="mt-3 grid gap-2 rounded-md border border-border/50 bg-background/70 p-3 md:grid-cols-3"
                          >
                            <input type="hidden" name="membershipId" value={membership.id} />
                            <input type="hidden" name="redirectPath" value="/mitglieder/produktionen/gewerke" />
                            <div className="space-y-1">
                              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Funktion
                              </label>
                              <select name="role" defaultValue={membership.role} className={selectClassName}>
                                {Object.values(DepartmentMembershipRole).map((role) => (
                                  <option key={role} value={role}>
                                    {ROLE_LABELS[role]}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Bezeichnung
                              </label>
                              <Input name="title" defaultValue={membership.title ?? ""} maxLength={120} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notiz</label>
                              <Input name="note" defaultValue={membership.note ?? ""} maxLength={200} />
                            </div>
                            <div className="md:col-span-3 flex justify-end">
                              <Button type="submit" variant="outline" size="sm">
                                Änderungen speichern
                              </Button>
                            </div>
                          </form>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="rounded-lg border border-dashed border-border/70 bg-background/50 p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Mitglied hinzufügen
                    </h4>
                    <form className="mt-3 grid gap-3 md:grid-cols-3" action={addDepartmentMemberAction} method="post">
                      <input type="hidden" name="departmentId" value={department.id} />
                      <input type="hidden" name="redirectPath" value="/mitglieder/produktionen/gewerke" />
                      <div className="space-y-1 md:col-span-1">
                        <label className="text-xs font-medium text-muted-foreground">Mitglied</label>
                        <select name="userId" className={selectClassName} required>
                          <option value="">Mitglied auswählen</option>
                          {availableUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {formatUserName(user)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Funktion</label>
                        <select name="role" className={selectClassName} defaultValue={DepartmentMembershipRole.member}>
                          {Object.values(DepartmentMembershipRole).map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Bezeichnung</label>
                        <Input name="title" maxLength={120} placeholder="z.B. Leitung" />
                      </div>
                      <div className="space-y-1 md:col-span-3">
                        <label className="text-xs font-medium text-muted-foreground">Notiz</label>
                        <Input name="note" maxLength={200} placeholder="optionale Notiz" />
                      </div>
                      <div className="md:col-span-3 flex justify-end">
                        <Button type="submit" size="sm">
                          Mitglied zuordnen
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
