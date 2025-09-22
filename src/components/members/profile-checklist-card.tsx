"use client";

import { CheckCircle2, Circle, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProfileCompletion } from "@/components/members/profile-completion-context";
import { cn } from "@/lib/utils";
import type { ProfileChecklistTarget } from "@/lib/profile-completion";

interface ProfileChecklistCardProps {
  onNavigateToSection?: (section: ProfileChecklistTarget) => void;
}

export function ProfileChecklistCard({
  onNavigateToSection,
}: ProfileChecklistCardProps) {
  const { items, completed, total, isComplete } = useProfileCompletion();

  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Card className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-secondary/10 via-background/85 to-background/95 shadow-lg shadow-secondary/10">
      <CardHeader className="space-y-4 px-6 pb-4 pt-6 sm:px-7">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-secondary">
          <Sparkles className="h-4 w-4" />
          Profil-Checkliste
        </div>
        <div className="flex flex-col gap-1">
          <CardTitle className="text-xl">
            {isComplete ? "Alles erledigt" : "Dein Profil wartet noch"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isComplete
              ? "Fantastisch! Alle Pflichtangaben sind auf dem neuesten Stand."
              : `Du hast ${completed} von ${total} Aufgaben abgeschlossen.`}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 px-6 pb-6 sm:px-7">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
          <div
            className="h-full rounded-full bg-gradient-to-r from-secondary via-secondary/80 to-primary"
            style={{ width: `${progress}%` }}
          />
        </div>
        <ul className="space-y-3">
          {items.map((item) => {
            const Icon = item.complete ? CheckCircle2 : Circle;
            return (
              <li
                key={item.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-border/50 bg-background/80 p-3 shadow-sm"
              >
                <div className="flex flex-1 gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border",
                      item.complete
                        ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-500"
                        : "border-border/60 bg-muted/30 text-muted-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
                {!item.complete && item.targetSection && onNavigateToSection ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="whitespace-nowrap"
                    onClick={() => onNavigateToSection(item.targetSection!)}
                  >
                    Bereich öffnen
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
