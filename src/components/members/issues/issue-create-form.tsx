"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { IssueSummary } from "./types";
import {
  DEFAULT_ISSUE_CATEGORY,
  DEFAULT_ISSUE_PRIORITY,
  ISSUE_CATEGORY_DESCRIPTIONS,
  ISSUE_CATEGORY_LABELS,
  ISSUE_CATEGORY_VALUES,
  ISSUE_PRIORITY_LABELS,
  ISSUE_PRIORITY_VALUES,
  isIssueCategory,
  isIssuePriority,
} from "@/lib/issues";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type IssueCreateFormValues = {
  title: string;
  description: string;
  category: string;
  priority: string;
};

const schema = z.object({
  title: z
    .string()
    .min(4, "Bitte gib einen aussagekräftigen Titel ein")
    .max(160, "Titel darf höchstens 160 Zeichen lang sein"),
  description: z
    .string()
    .min(10, "Beschreibe dein Anliegen mit mindestens 10 Zeichen")
    .max(4000, "Beschreibung darf höchstens 4000 Zeichen lang sein"),
  category: z
    .string()
    .refine(isIssueCategory, "Ungültige Kategorie"),
  priority: z
    .string()
    .refine(isIssuePriority, "Ungültige Priorität"),
});

type IssueCreateFormProps = {
  onCreated: (issue: IssueSummary) => void;
  onSuccess?: () => void;
};

export function IssueCreateForm({ onCreated, onSuccess }: IssueCreateFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<IssueCreateFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      category: DEFAULT_ISSUE_CATEGORY,
      priority: DEFAULT_ISSUE_PRIORITY,
    },
  });

  const categoryOptions = useMemo(() => ISSUE_CATEGORY_VALUES, []);
  const priorityOptions = useMemo(() => ISSUE_PRIORITY_VALUES, []);

  const handleSubmit = form.handleSubmit(async (values) => {
    const { title, description, category, priority } = values;
    setSubmitting(true);
    try {
      const response = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          priority,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Anliegen konnte nicht erstellt werden");
      }
      if (!data?.issue) {
        throw new Error("Unerwartete Antwort vom Server");
      }
      onCreated(data.issue as IssueSummary);
      toast.success("Anliegen wurde erstellt");
      form.reset({
        title: "",
        description: "",
        category,
        priority,
      });
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Anliegen konnte nicht erstellt werden";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Titel</FormLabel>
              <FormControl>
                <Input placeholder="Worum geht es?" autoComplete="off" {...field} />
              </FormControl>
              <FormDescription>Fasse dein Anliegen in einem kurzen Satz zusammen.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kategorie</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Kategorie wählen" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        <div className="flex flex-col text-left">
                          <span>{ISSUE_CATEGORY_LABELS[option]}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {ISSUE_CATEGORY_DESCRIPTIONS[option]}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priorität</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Priorität wählen" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {priorityOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {ISSUE_PRIORITY_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Die Priorität hilft dem Team dabei, dringende Anliegen zuerst zu bearbeiten.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Beschreibung</FormLabel>
              <FormControl>
                <Textarea
                  rows={6}
                  placeholder="Beschreibe das Problem, gewünschte Verbesserungen oder relevante Schritte im Detail."
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Je genauer du dein Anliegen beschreibst, desto schneller kann es bearbeitet werden.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Speichern..." : "Anliegen melden"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
