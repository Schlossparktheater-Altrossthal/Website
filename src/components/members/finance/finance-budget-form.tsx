"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { FinanceBudgetDTO } from "@/app/api/finance/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const budgetSchema = z.object({
  category: z.string().min(2, "Kategorie angeben").max(120),
  plannedAmount: z
    .string()
    .min(1, "Planwert angeben")
    .refine((value) => {
      const normalized = value.replace(",", ".");
      const parsed = Number(normalized);
      return !Number.isNaN(parsed) && parsed >= 0;
    }, "Planwert muss eine positive Zahl sein"),
  currency: z.string().trim().min(1).max(10),
  notes: z.string().max(400).optional().nullable(),
  showId: z.string().optional().nullable(),
});

type FinanceBudgetFormValues = z.infer<typeof budgetSchema>;

type FinanceBudgetFormProps = {
  showOptions: { id: string; title: string | null; year: number }[];
  onCreated?: (budget: FinanceBudgetDTO) => void;
  onUpdated?: (budget: FinanceBudgetDTO) => void;
  onCancelEdit?: () => void;
  initialBudget?: FinanceBudgetDTO | null;
};

function formatShowOption(show: { id: string; title: string | null; year: number }) {
  const parts = [];
  if (show.year) parts.push(show.year.toString());
  if (show.title) parts.push(show.title);
  return parts.join(" • ") || "Unbenannte Produktion";
}

export function FinanceBudgetForm({
  showOptions,
  onCreated,
  onUpdated,
  onCancelEdit,
  initialBudget,
}: FinanceBudgetFormProps) {
  const form = useForm<FinanceBudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      category: "",
      plannedAmount: "",
      currency: "EUR",
      notes: "",
      showId: "",
    },
  });

  useEffect(() => {
    if (!initialBudget) {
      form.reset({ category: "", plannedAmount: "", currency: "EUR", notes: "", showId: "" });
      return;
    }
    form.reset({
      category: initialBudget.category,
      plannedAmount: initialBudget.plannedAmount.toString(),
      currency: initialBudget.currency,
      notes: initialBudget.notes ?? "",
      showId: initialBudget.show.id ?? "",
    });
  }, [initialBudget, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const payload = {
      category: values.category.trim(),
      plannedAmount: Number(values.plannedAmount.replace(",", ".")),
      currency: values.currency.trim().toUpperCase(),
      notes: values.notes?.trim() || undefined,
      showId: values.showId || undefined,
    };

    const targetUrl = initialBudget ? `/api/finance/budgets/${initialBudget.id}` : "/api/finance/budgets";
    const method = initialBudget ? "PATCH" : "POST";

    try {
      const response = await fetch(targetUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Budget konnte nicht gespeichert werden");
      }
      const budget = data?.budget as FinanceBudgetDTO | undefined;
      if (!budget) throw new Error("Unerwartete Antwort vom Server");
      if (initialBudget) {
        onUpdated?.(budget);
        toast.success("Budget aktualisiert");
        onCancelEdit?.();
      } else {
        onCreated?.(budget);
        toast.success("Budget angelegt");
        form.reset({ category: "", plannedAmount: "", currency: payload.currency, notes: "", showId: values.showId ?? "" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Budget konnte nicht gespeichert werden");
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kategorie</FormLabel>
                <FormControl>
                  <Input placeholder="z. B. Kostüme" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="plannedAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Geplanter Betrag</FormLabel>
                <FormControl>
                  <Input
                    inputMode="decimal"
                    placeholder="0,00"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Währung</FormLabel>
                <FormControl>
                  <Input placeholder="z. B. EUR" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="showId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Produktion</FormLabel>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Produktion auswählen" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">Keiner Produktion zugeordnet</SelectItem>
                    {showOptions.map((show) => (
                      <SelectItem key={show.id} value={show.id}>
                        {formatShowOption(show)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notizen</FormLabel>
              <FormControl>
                <Textarea placeholder="Zweck, Annahmen oder Hinweise" value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-2">
          <Button type="submit">{initialBudget ? "Budget speichern" : "Budget anlegen"}</Button>
          {initialBudget ? (
            <Button type="button" variant="ghost" onClick={onCancelEdit}>
              Abbrechen
            </Button>
          ) : null}
        </div>
      </form>
    </Form>
  );
}
