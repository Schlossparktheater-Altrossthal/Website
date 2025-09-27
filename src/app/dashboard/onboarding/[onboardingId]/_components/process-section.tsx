"use client";

import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { z } from "zod";

import { documentStatusSchema, processStepSchema } from "@/lib/onboarding/dashboard-schemas";

type ProcessSectionProps = {
  steps: Array<z.infer<typeof processStepSchema>>;
  documents: z.infer<typeof documentStatusSchema>;
};

export function ProcessSection({ steps, documents }: ProcessSectionProps) {
  const totalDocuments = documents.uploaded + documents.skipped + documents.pending;
  return (
    <Card className="h-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">Prozess & Dokumente</CardTitle>
        <p className="text-sm text-muted-foreground">Fortschritt entlang der Onboarding-Schritte.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {steps.map((step, index) => {
            const completion = Math.min(100, Math.max(0, step.completionRate));
            const dropout = Math.min(100, Math.max(0, step.dropoutRate));
            const barColor = completion >= 75 ? "bg-emerald-400" : completion >= 50 ? "bg-amber-400" : "bg-rose-400";
            return (
              <div key={step.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span className="text-muted-foreground">{step.label}</span>
                  <span className="text-foreground/80">{completion.toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted/50">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${completion}%` }}
                    transition={{ delay: index * 0.05, duration: 0.45, ease: "easeOut" }}
                    className={`h-full rounded-full ${barColor}`}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Abbruchquote: {dropout.toFixed(0)}%</p>
              </div>
            );
          })}
        </div>
        <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Dokumentstatus</h4>
          {totalDocuments === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Noch keine Dokumente eingereicht.</p>
          ) : (
            <dl className="mt-2 grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Uploads</dt>
                <dd className="font-medium">{documents.uploaded}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Übersprungen</dt>
                <dd className="font-medium">{documents.skipped}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Ausstehend</dt>
                <dd className="font-medium">{documents.pending}</dd>
              </div>
            </dl>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
