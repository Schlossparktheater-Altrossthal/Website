"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type {
  DepartmentGrantState,
  PermissionWorkbenchDepartment,
} from "@/components/members/permissions/permission-workbench-client";
import { Building2, FilterX, Shield } from "lucide-react";

type DepartmentAdministrationPanelProps = {
  departments: PermissionWorkbenchDepartment[];
  departmentGrants: DepartmentGrantState;
};

export function DepartmentAdministrationPanel({
  departments,
  departmentGrants,
}: DepartmentAdministrationPanelProps) {
  const [search, setSearch] = useState("");
  const [onlyApprovalRequired, setOnlyApprovalRequired] = useState(false);

  const stats = useMemo(() => {
    const withAssignments = departments.filter((department) => (departmentGrants[department.id]?.size ?? 0) > 0).length;
    const approvalCount = departments.filter((department) => department.requiresJoinApproval).length;
    return { withAssignments, approvalCount };
  }, [departments, departmentGrants]);

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

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground">Gewerke insgesamt</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{departments.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground">Mit Rechten</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.withAssignments}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground">Genehmigungspflichtig</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.approvalCount}</CardContent>
        </Card>
      </div>

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
                  <div className="text-xs text-muted-foreground">
                    {assignmentCount > 0
                      ? "Zuweisungen verwaltest du über den Rechte-Explorer."
                      : "Noch keine Rechte zugewiesen."}
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
    </div>
  );
}

export default DepartmentAdministrationPanel;
