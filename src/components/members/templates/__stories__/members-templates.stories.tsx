import React from "react";

import { MembersAppShell } from "@/components/members/members-app-shell";
import {
  MembersListPage,
  MembersDetailPage,
  MembersWizardPage,
  FilterChips,
  FilterChip,
  SwipeActionsList,
  SwipeActionsItem,
  type WizardStep,
} from "@/components/members/templates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type StoryMeta = {
  title: string;
  parameters?: Record<string, unknown>;
};

type StoryConfig = {
  name?: string;
  render: () => React.ReactNode;
};

const meta: StoryMeta = {
  title: "Members/Templates/Overview",
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

function TemplatePreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <MembersAppShell
        permissions={[]}
        assignmentFocus="none"
        hasDepartmentMemberships={false}
      >
        {children}
      </MembersAppShell>
    </div>
  );
}

export const ListPageExample: StoryConfig = {
  name: "List Page",
  render: () => {
    const steps: WizardStep[] = [
      { id: "collect", label: "Daten sammeln" },
      { id: "review", label: "Überprüfen" },
      { id: "publish", label: "Veröffentlichen" },
    ];

    return (
      <TemplatePreviewShell>
        <MembersListPage
          title="Repertoire"
          description="Zeigt alle geplanten Programmpunkte inklusive Status und Verantwortlichen."
          breadcrumbs={[{ href: "/mitglieder", label: "Mitglieder" }, { href: "/mitglieder/repertoire", label: "Repertoire" }]}
          actions={<Button>Neues Stück</Button>}
          filters={
            <FilterChips label="Filter">
              <FilterChip active>Alle</FilterChip>
              <FilterChip>Zugewiesen</FilterChip>
              <FilterChip href="#drafts">Entwürfe</FilterChip>
            </FilterChips>
          }
          stickyCta={<Button className="w-full">Schnelle Erstellung</Button>}
        >
          <SwipeActionsList>
            <SwipeActionsItem
              actions={[
                { id: "open", label: "Details", href: "/mitglieder/repertoire/1", tone: "primary" },
                { id: "archive", label: "Archivieren", onSelect: () => undefined },
              ]}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Ouvertüre</h3>
                    <p className="text-sm text-muted-foreground">Probephase · Chor</p>
                  </div>
                  <Badge variant="outline">Freigegeben</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enthält Instrumentation und Bühnenhinweise. Zuletzt aktualisiert vor zwei Tagen.
                </p>
              </div>
            </SwipeActionsItem>
          </SwipeActionsList>
        </MembersListPage>
        <MembersDetailPage
          title="Mitgliedsprofil"
          subtitle="Team"
          description="Kompletter Überblick über Rollen, Kontaktdaten und aktive Einsätze."
          breadcrumbs={[{ href: "/mitglieder", label: "Mitglieder" }, { label: "Timo Beispiel" }]}
          actions={<Button variant="secondary">Profil teilen</Button>}
          meta={<Badge variant="outline">Aktiv seit 2019</Badge>}
          sidebar={<div className="rounded-xl border border-border/60 p-4 text-sm">Sidebar-Inhalte</div>}
        >
          <div className="rounded-2xl border border-border/60 p-4">
            <p className="text-sm text-muted-foreground">Hier steht der eigentliche Inhalt der Detailseite.</p>
          </div>
        </MembersDetailPage>
        <MembersWizardPage
          title="Onboarding"
          description="Schrittweise durch die wichtigsten Einstellungen führen."
          breadcrumbs={[{ href: "/mitglieder", label: "Mitglieder" }, { label: "Onboarding" }]}
          steps={steps}
          activeStepId="review"
          stickyCta={<Button className="w-full">Weiter zum nächsten Schritt</Button>}
        >
          <div className="rounded-2xl border border-border/60 p-6 text-sm text-muted-foreground">
            Inhalt des aktuellen Schritts.
          </div>
        </MembersWizardPage>
      </TemplatePreviewShell>
    );
  },
};
