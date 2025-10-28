"use client";

import { type Dispatch, type SetStateAction, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  DepartmentGrantState,
  PermissionWorkbenchDepartment,
  PermissionWorkbenchPermission,
} from "@/components/members/permissions/permission-workbench-client";
import { Building2, FilterX, Shield, Sparkle } from "lucide-react";
import { DepartmentPermissionDrawer } from "@/components/members/permissions/department-permission-drawer";

type DepartmentAdministrationPanelProps = {
  permissions: PermissionWorkbenchPermission[];
  departments: PermissionWorkbenchDepartment[];
  departmentGrants: DepartmentGrantState;
  setDepartmentGrants: Dispatch<SetStateAction<DepartmentGrantState>>;
};

export function DepartmentAdministrationPanel({
  permissions,
  departments,
  departmentGrants,
  setDepartmentGrants,
}: DepartmentAdministrationPanelProps) {
  const [search, setSearch] = useState("");
  const [onlyApprovalRequired, setOnlyApprovalRequired] = useState(false);
  const [activeDepartmentId, setActiveDepartmentId] = useState<string | null>(null);

  const analytics = useMemo(() => {
    const totalDepartments = departments.length;
    const totalPermissions = permissions.length;

    const assignmentsPerDepartment = departments.map((department) => {
      const count = departmentGrants[department.id]?.size ?? 0;
      return { id: department.id, name: department.name, count };
    });

    const totalAssignments = assignmentsPerDepartment.reduce((sum, entry) => sum + entry.count, 0);
    const withAssignments = assignmentsPerDepartment.filter((entry) => entry.count > 0).length;
    const approvalCount = departments.filter((department) => department.requiresJoinApproval).length;

    const averagePerDepartment = totalDepartments > 0 ? totalAssignments / totalDepartments : 0;
    const coverageDenominator = totalDepartments * totalPermissions;
    const coverage = coverageDenominator > 0 ? totalAssignments / coverageDenominator : 0;
    const activeShare = totalDepartments > 0 ? withAssignments / totalDepartments : 0;

    const bucketConfig = [
      { id: "none", label: "Keine Rechte", min: 0, max: 0 },
      { id: "few", label: "1–2 Rechte", min: 1, max: 2 },
      { id: "core", label: "3–5 Rechte", min: 3, max: 5 },
      { id: "many", label: "≥6 Rechte", min: 6, max: Number.POSITIVE_INFINITY },
    ] as const;

    const bucketDistribution = bucketConfig.map((bucket) => {
      const count = assignmentsPerDepartment.filter(
        (entry) => entry.count >= bucket.min && entry.count <= bucket.max,
      ).length;
      const share = totalDepartments > 0 ? count / totalDepartments : 0;
      return { ...bucket, count, share };
    });

    const permissionUsage = permissions.map((permission) => {
      let count = 0;
      for (const department of departments) {
        const grants = departmentGrants[department.id];
        if (grants?.has(permission.key)) {
          count += 1;
        }
      }
      const share = totalDepartments > 0 ? count / totalDepartments : 0;
      return { key: permission.key, label: permission.label, count, share };
    });

    const topPermissions = permissionUsage
      .filter((entry) => entry.count > 0)
      .sort((a, b) => {
        if (b.count === a.count) {
          return a.label.localeCompare(b.label, "de");
        }
        return b.count - a.count;
      })
      .slice(0, 6);

    const dormantPermissions = permissionUsage.filter((entry) => entry.count === 0).length;

    const topDepartments = assignmentsPerDepartment
      .filter((entry) => entry.count > 0)
      .sort((a, b) => {
        if (b.count === a.count) {
          return a.name.localeCompare(b.name, "de");
        }
        return b.count - a.count;
      })
      .slice(0, 3)
      .map((entry) => ({ ...entry, share: totalPermissions > 0 ? entry.count / totalPermissions : 0 }));

    return {
      totalDepartments,
      totalPermissions,
      totalAssignments,
      withAssignments,
      approvalCount,
      averagePerDepartment,
      coverage,
      activeShare,
      bucketDistribution,
      topPermissions,
      dormantPermissions,
      topDepartments,
    };
  }, [departments, departmentGrants, permissions]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return departments.filter((department) => {
      if (onlyApprovalRequired && !department.requiresJoinApproval) return false;
      if (!term) return true;
      return [department.name, department.slug].some((value) =>
        value ? value.toLowerCase().includes(term) : false,
      );
    });
  }, [departments, search, onlyApprovalRequired]);

  const activeDepartment = useMemo(
    () => (activeDepartmentId ? departments.find((entry) => entry.id === activeDepartmentId) ?? null : null),
    [activeDepartmentId, departments],
  );

  const numberFormatter = useMemo(() => new Intl.NumberFormat("de-DE"), []);
  const averageFormatter = useMemo(
    () =>
      new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [],
  );
  const percentFormatter = useMemo(
    () =>
      new Intl.NumberFormat("de-DE", {
        style: "percent",
        maximumFractionDigits: 0,
      }),
    [],
  );

  const inactiveDepartments = analytics.totalDepartments - analytics.withAssignments;
  const approvalShare = analytics.totalDepartments > 0 ? analytics.approvalCount / analytics.totalDepartments : 0;

  const activeIntent =
    analytics.totalDepartments === 0
      ? "muted"
      : analytics.activeShare >= 0.75
        ? "success"
        : analytics.activeShare >= 0.5
          ? "warning"
          : "destructive";

  const coverageIntent =
    analytics.totalAssignments === 0 || analytics.totalPermissions === 0 || analytics.totalDepartments === 0
      ? "muted"
      : analytics.coverage >= 0.6
        ? "success"
        : analytics.coverage >= 0.35
          ? "warning"
          : "destructive";

  const approvalIntent =
    analytics.totalDepartments === 0
      ? "muted"
      : approvalShare <= 0.33
        ? "success"
        : approvalShare <= 0.66
          ? "warning"
          : "destructive";

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border/70 bg-card/60">
            <CardHeader className="space-y-2">
              <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground">
                Gewerke insgesamt
              </CardTitle>
              <p className="text-sm text-muted-foreground/80">
                {analytics.totalPermissions > 0
                  ? `${numberFormatter.format(analytics.totalPermissions)} definierte Rechte`
                  : "Noch keine Rechte definiert."}
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tracking-tight text-foreground">
                {numberFormatter.format(analytics.totalDepartments)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground">
                  Aktive Gewerke
                </CardTitle>
                <Badge variant={activeIntent} size="sm" className="uppercase tracking-[0.18em]">
                  {percentFormatter.format(analytics.activeShare)} aktiv
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground/80">
                {inactiveDepartments > 0
                  ? `${numberFormatter.format(inactiveDepartments)} ohne Rechtezuweisung`
                  : "Alle Gewerke mit mindestens einem Recht."}
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tracking-tight text-foreground">
                {numberFormatter.format(analytics.withAssignments)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground">
                  Rechte vergeben
                </CardTitle>
                <Badge variant={coverageIntent} size="sm" className="uppercase tracking-[0.18em]">
                  {percentFormatter.format(analytics.coverage)} Abdeckung
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground/80">
                Ø {averageFormatter.format(analytics.averagePerDepartment)} Rechte pro Gewerk
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tracking-tight text-foreground">
                {numberFormatter.format(analytics.totalAssignments)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground">
                  Genehmigungspflichtig
                </CardTitle>
                <Badge variant={approvalIntent} size="sm" className="uppercase tracking-[0.18em]">
                  {percentFormatter.format(approvalShare)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground/80">
                Gewerke mit Zustimmungspflicht für Beitritte.
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tracking-tight text-foreground">
                {numberFormatter.format(analytics.approvalCount)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border-border/70 bg-card/60">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base font-semibold tracking-tight text-foreground">
                Rechte pro Gewerk
              </CardTitle>
              <p className="text-sm text-muted-foreground">Verteilung der vergebenen Rechte nach Umfang.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {analytics.bucketDistribution.map((bucket) => (
                <div key={bucket.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span className="text-muted-foreground">{bucket.label}</span>
                    <span className="text-muted-foreground">
                      {numberFormatter.format(bucket.count)}
                      {analytics.totalDepartments > 0
                        ? ` · ${percentFormatter.format(bucket.share)}`
                        : ""}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/50">
                    <div
                      className="h-full rounded-full bg-primary/60"
                      style={{ width: `${Math.min(100, Math.max(0, bucket.share * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base font-semibold tracking-tight text-foreground">
                Top-Rechte nach Abdeckung
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {analytics.dormantPermissions > 0
                  ? `${numberFormatter.format(analytics.dormantPermissions)} Rechte ohne Gewerk.`
                  : "Alle Rechte mindestens einmal vergeben."}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {analytics.topPermissions.length > 0 ? (
                <ul className="space-y-3">
                  {analytics.topPermissions.map((permission) => (
                    <li key={permission.key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span className="text-foreground/85">{permission.label}</span>
                        <span className="text-muted-foreground">
                          {numberFormatter.format(permission.count)}
                          {analytics.totalDepartments > 0
                            ? ` · ${percentFormatter.format(permission.share)}`
                            : ""}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/50">
                        <div
                          className="h-full rounded-full bg-success/50"
                          style={{ width: `${Math.min(100, Math.max(0, permission.share * 100))}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Noch keine Rechte vergeben.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base font-semibold tracking-tight text-foreground">
                Aktivste Gewerke
              </CardTitle>
              <p className="text-sm text-muted-foreground">Meiste Rechtezuweisungen im Vergleich.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {analytics.topDepartments.length > 0 ? (
                <ol className="space-y-3">
                  {analytics.topDepartments.map((department, index) => (
                    <li key={department.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-xs font-semibold text-foreground/80">
                            #{index + 1}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-foreground/90">{department.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {numberFormatter.format(department.count)} Rechte
                              {analytics.totalPermissions > 0
                                ? ` · ${percentFormatter.format(department.share)}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-muted/50">
                        <div
                          className="h-full rounded-full bg-info/50"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, analytics.totalPermissions > 0 ? department.share * 100 : 0),
                            )}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">Noch keine aktiven Gewerke vorhanden.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/60 p-4 shadow-sm md:flex-row md:items-end md:justify-between">
        <div className="flex-1">
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Gewerke durchsuchen
          </label>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name oder Slug"
            spellCheck={false}
          />
        </div>
        <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-end md:justify-end">
          <Button
            type="button"
            variant={onlyApprovalRequired ? "primary" : "outline"}
            size="sm"
            className="md:w-auto"
            onClick={() => setOnlyApprovalRequired((current) => !current)}
          >
            <Shield className="h-4 w-4" />
            {onlyApprovalRequired ? "Alle anzeigen" : "Nur mit Zustimmung"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!search && !onlyApprovalRequired}
            onClick={() => {
              setSearch("");
              setOnlyApprovalRequired(false);
            }}
          >
            <FilterX className="h-4 w-4" />
            Filter leeren
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((department) => {
          const assignmentCount = departmentGrants[department.id]?.size ?? 0;
          return (
            <Card key={department.id} className="border-border/70 bg-card/70">
              <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{department.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {department.slug ? department.slug : "Kein Slug hinterlegt"}
                  </div>
                  {department.requiresJoinApproval ? (
                    <Badge variant="warning" size="sm" className="w-fit">
                      Zustimmung nötig
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-col items-start gap-2 md:items-end">
                  <Badge variant={assignmentCount > 0 ? "secondary" : "muted"} size="sm">
                    {assignmentCount} Rechte
                  </Badge>
                  <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                    <div>
                      {assignmentCount > 0
                        ? "Direkt hier bearbeiten oder Details ansehen."
                        : "Noch keine Rechte zugewiesen."}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="font-semibold"
                        onClick={() => setActiveDepartmentId(department.id)}
                      >
                        <Sparkle className="mr-1 h-3.5 w-3.5" />
                        Rechte bearbeiten
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 ? (
          <Card className="border-dashed bg-muted/40 text-center text-sm text-muted-foreground">
            <CardContent className="py-6">Keine Gewerke entsprechen den Filtern.</CardContent>
          </Card>
        ) : null}
      </div>

      <DepartmentPermissionDrawer
        open={Boolean(activeDepartment)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setActiveDepartmentId(null);
        }}
        department={activeDepartment}
        permissions={permissions}
        departmentGrants={departmentGrants}
        setDepartmentGrants={setDepartmentGrants}
      />
    </div>
  );
}

export default DepartmentAdministrationPanel;
