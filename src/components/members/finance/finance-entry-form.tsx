"use client";

import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { VisibilityScope } from "@prisma/client";
import {
  FINANCE_ENTRY_KIND_DESCRIPTIONS,
  FINANCE_ENTRY_KIND_LABELS,
  FINANCE_ENTRY_KIND_VALUES,
  FINANCE_ENTRY_STATUS_LABELS,
  FINANCE_ENTRY_STATUS_VALUES,
  FINANCE_TYPE_LABELS,
} from "@/lib/finance";
import type { FinanceBudgetDTO, FinanceEntryDTO } from "@/app/api/finance/utils";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const attachmentSchema = z.object({
  filename: z.string().min(1, "Dateiname angeben"),
  url: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^https?:\/\//i.test(value), {
      message: "Ungültige URL (https://...)",
    }),
});

const financeEntryFormSchema = z
  .object({
    title: z.string().min(3, "Titel angeben").max(200),
    type: z.enum(["income", "expense"] as const),
    kind: z.enum(FINANCE_ENTRY_KIND_VALUES),
    status: z.enum(FINANCE_ENTRY_STATUS_VALUES),
    amount: z
      .string()
      .min(1, "Betrag angeben")
      .refine((value) => {
        const normalized = value.replace(",", ".");
        const parsed = Number(normalized);
        return !Number.isNaN(parsed) && parsed > 0;
      }, "Betrag muss größer als 0 sein"),
    currency: z.string().trim().min(1).max(10),
    category: z.string().max(120).optional().nullable(),
    bookingDate: z.string().min(1, "Buchungsdatum wählen"),
    dueDate: z.string().optional().nullable(),
    showId: z.string().optional().nullable(),
    budgetId: z.string().optional().nullable(),
    memberPaidById: z.string().optional().nullable(),
    invoiceNumber: z.string().max(120).optional().nullable(),
    vendor: z.string().max(160).optional().nullable(),
    donationSource: z.string().max(160).optional().nullable(),
    donorContact: z.string().max(200).optional().nullable(),
    description: z.string().max(4000).optional().nullable(),
    visibilityScope: z.enum(["finance", "board"] as const),
    attachments: z.array(attachmentSchema).optional(),
  })
  .superRefine((values, ctx) => {
    if (values.kind === "invoice" && !values.memberPaidById) {
      ctx.addIssue({
        path: ["memberPaidById"],
        code: z.ZodIssueCode.custom,
        message: "Für Rechnungen muss ein zahlendes Mitglied angegeben werden.",
      });
    }
    if (values.kind === "donation" && !values.donationSource) {
      ctx.addIssue({
        path: ["donationSource"],
        code: z.ZodIssueCode.custom,
        message: "Spenden benötigen eine Quelle.",
      });
    }
  });

type FinanceEntryFormValues = z.infer<typeof financeEntryFormSchema>;

type FinanceEntryFormProps = {
  onCreated: (entry: FinanceEntryDTO) => void;
  showOptions: { id: string; title: string | null; year: number }[];
  memberOptions: { id: string; name: string | null; email: string | null }[];
  budgetOptions: FinanceBudgetDTO[];
  allowedScopes: VisibilityScope[];
  canApprove: boolean;
  onAfterSubmit?: () => void;
};

function formatShowLabel(show: { id: string; title: string | null; year: number }) {
  const parts = [];
  if (show.year) parts.push(show.year.toString());
  if (show.title) parts.push(show.title);
  return parts.join(" • ") || "Unbenannte Produktion";
}

function formatMemberLabel(member: { name: string | null; email: string | null }) {
  if (member.name && member.email) return `${member.name} (${member.email})`;
  return member.name ?? member.email ?? "Unbekannt";
}

const EMPTY_SELECT_VALUE = "__none__";

export function FinanceEntryForm({
  onCreated,
  showOptions,
  memberOptions,
  budgetOptions,
  allowedScopes,
  canApprove,
  onAfterSubmit,
}: FinanceEntryFormProps) {
  const defaultScope = allowedScopes.includes("finance") ? "finance" : allowedScopes[0] ?? "finance";
  const form = useForm<FinanceEntryFormValues>({
    resolver: zodResolver(financeEntryFormSchema),
    defaultValues: {
      title: "",
      type: "expense",
      kind: "general",
      status: "draft",
      amount: "",
      currency: "EUR",
      category: "",
      bookingDate: new Date().toISOString().slice(0, 10),
      dueDate: "",
      showId: "",
      budgetId: "",
      memberPaidById: "",
      invoiceNumber: "",
      vendor: "",
      donationSource: "",
      donorContact: "",
      description: "",
      visibilityScope: defaultScope,
      attachments: [],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "attachments" });
  const [submitting, setSubmitting] = useState(false);

  const watchKind = form.watch("kind");
  const watchShowId = form.watch("showId");

  const filteredBudgets = useMemo(() => {
    if (!watchShowId) return budgetOptions;
    return budgetOptions.filter((budget) => budget.show.id === watchShowId);
  }, [budgetOptions, watchShowId]);

  useEffect(() => {
    const currentStatus = form.getValues("status");
    if (watchKind === "invoice" && currentStatus === "draft") {
      form.setValue("status", "pending");
    } else if (watchKind === "donation" && (currentStatus === "draft" || currentStatus === "pending")) {
      form.setValue("status", canApprove ? "approved" : "pending");
    } else if (watchKind === "general" && currentStatus === "pending") {
      form.setValue("status", "draft");
    }
  }, [form, watchKind, canApprove]);

  const statusOptions = useMemo(() => {
    return FINANCE_ENTRY_STATUS_VALUES.filter((status) => {
      if (status === "approved" || status === "paid") {
        return canApprove;
      }
      return true;
    });
  }, [canApprove]);

  const visibilityOptions: VisibilityScope[] = allowedScopes.includes("board") ? ["finance", "board"] : ["finance"];

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const payload = {
        title: values.title.trim(),
        type: values.type,
        kind: values.kind,
        status: values.status,
        amount: Number(values.amount.replace(",", ".")),
        currency: values.currency.trim().toUpperCase(),
        category: values.category?.trim() || undefined,
        bookingDate: values.bookingDate,
        dueDate: values.dueDate ? values.dueDate : undefined,
        showId: values.showId || undefined,
        budgetId: values.budgetId || undefined,
        memberPaidById: values.memberPaidById || undefined,
        invoiceNumber: values.invoiceNumber?.trim() || undefined,
        vendor: values.vendor?.trim() || undefined,
        donationSource: values.donationSource?.trim() || undefined,
        donorContact: values.donorContact?.trim() || undefined,
        description: values.description?.trim() || undefined,
        visibilityScope: values.visibilityScope,
        attachments: values.attachments?.map((attachment) => ({
          filename: attachment.filename.trim(),
          url: attachment.url && attachment.url.trim().length
            ? attachment.url.trim()
            : undefined,
        })),
      };

      const response = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Buchung konnte nicht angelegt werden");
      }
      if (!data?.entry) {
        throw new Error("Unerwartete Antwort vom Server");
      }
      onCreated(data.entry as FinanceEntryDTO);
      toast.success("Finanzbuchung wurde gespeichert");
      form.reset({
        title: "",
        type: values.type,
        kind: values.kind,
        status: values.kind === "invoice" ? "pending" : values.kind === "donation" && canApprove ? "approved" : "draft",
        amount: "",
        currency: values.currency,
        category: "",
        bookingDate: new Date().toISOString().slice(0, 10),
        dueDate: "",
        showId: values.showId ?? "",
        budgetId: values.budgetId ?? "",
        memberPaidById: values.kind === "invoice" ? values.memberPaidById ?? "" : "",
        invoiceNumber: "",
        vendor: "",
        donationSource: "",
        donorContact: "",
        description: "",
        visibilityScope: values.visibilityScope,
        attachments: [],
      });
      onAfterSubmit?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Buchung konnte nicht angelegt werden";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  });

  const showMemberField = watchKind === "invoice";
  const showDonationFields = watchKind === "donation";

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Titel</FormLabel>
                <FormControl>
                  <Input placeholder="Kurzbeschreibung" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Betrag</FormLabel>
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
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Art</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Typ wählen" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(["expense", "income"] as const).map((option) => (
                      <SelectItem key={option} value={option}>
                        {FINANCE_TYPE_LABELS[option]}
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
            name="kind"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Buchungstyp</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Typ wählen" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {FINANCE_ENTRY_KIND_VALUES.map((option) => (
                      <SelectItem key={option} value={option}>
                        <div className="flex flex-col text-left">
                          <span>{FINANCE_ENTRY_KIND_LABELS[option]}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {FINANCE_ENTRY_KIND_DESCRIPTIONS[option]}
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
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Status wählen" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {FINANCE_ENTRY_STATUS_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  {canApprove ? "Status kann beim Erfassen gesetzt werden." : "Freigabe und Zahlung nur durch Finanzfreigabe."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bookingDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Buchungsdatum</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fällig bis</FormLabel>
                <FormControl>
                  <Input type="date" value={field.value ?? ""} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kategorie</FormLabel>
                <FormControl>
                  <Input placeholder="z. B. Kostüme" value={field.value ?? ""} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="showId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Produktion</FormLabel>
                <Select
                  value={field.value ? field.value : EMPTY_SELECT_VALUE}
                  onValueChange={(value) => field.onChange(value === EMPTY_SELECT_VALUE ? "" : value)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Produktion auswählen" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={EMPTY_SELECT_VALUE}>Keine Zuordnung</SelectItem>
                    {showOptions.map((show) => (
                      <SelectItem key={show.id} value={show.id}>
                        {formatShowLabel(show)}
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
            name="budgetId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Budget</FormLabel>
                <Select
                  value={field.value ? field.value : EMPTY_SELECT_VALUE}
                  onValueChange={(value) => field.onChange(value === EMPTY_SELECT_VALUE ? "" : value)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Budget auswählen" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={EMPTY_SELECT_VALUE}>Kein Budget</SelectItem>
                    {filteredBudgets.map((budget) => (
                      <SelectItem key={budget.id} value={budget.id}>
                        {budget.category} ({budget.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Budgets werden automatisch nach Produktion gefiltert.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {showMemberField ? (
          <FormField
            control={form.control}
            name="memberPaidById"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Zahlendes Mitglied</FormLabel>
                <Select
                  value={field.value ? field.value : EMPTY_SELECT_VALUE}
                  onValueChange={(value) => field.onChange(value === EMPTY_SELECT_VALUE ? "" : value)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Mitglied wählen" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={EMPTY_SELECT_VALUE}>Mitglied wählen</SelectItem>
                    {memberOptions.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {formatMemberLabel(member)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {watchKind === "invoice" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="invoiceNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rechnungsnummer</FormLabel>
                  <FormControl>
                    <Input placeholder="Rechnung / Quittung" value={field.value ?? ""} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vendor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lieferant / Händler</FormLabel>
                  <FormControl>
                    <Input placeholder="Name des Händlers" value={field.value ?? ""} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ) : null}

        {showDonationFields ? (
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="donationSource"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Spendenquelle</FormLabel>
                  <FormControl>
                    <Input placeholder="Person, Organisation oder Kampagne" value={field.value ?? ""} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="donorContact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kontakt</FormLabel>
                  <FormControl>
                    <Input placeholder="Kontaktinformation" value={field.value ?? ""} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ) : null}

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Beschreibung</FormLabel>
              <FormControl>
                <Textarea placeholder="Detailbeschreibung, Verwendungszweck oder Hinweise" value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="visibilityScope"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sichtbarkeit</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {visibilityOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === "finance" ? "Finanzteam" : "Nur Vorstand"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Anhänge</h3>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => append({ filename: "" })}
            >
              Anhang hinzufügen
            </Button>
          </div>
          {fields.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Optional: Verweise auf abgelegte Belege (z. B. Cloud-Ordner) hinzufügen.
            </p>
          ) : null}
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 rounded-md border border-border/60 p-3 md:grid-cols-[1fr_1fr_auto]">
                <FormField
                  control={form.control}
                  name={`attachments.${index}.filename`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Bezeichnung</FormLabel>
                      <FormControl>
                        <Input placeholder="Belegname" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`attachments.${index}.url`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Link</FormLabel>
                      <FormControl>
                        <Input placeholder="https://…" value={field.value ?? ""} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-end justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                    Entfernen
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={submitting} className={cn(submitting && "opacity-70")}> 
          {submitting ? "Speichere..." : "Finanzbuchung anlegen"}
        </Button>
      </form>
    </Form>
  );
}
