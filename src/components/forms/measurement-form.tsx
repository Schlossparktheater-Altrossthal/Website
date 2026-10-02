"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  MEASUREMENT_TYPE_LABELS,
  MEASUREMENT_UNIT_LABELS,
  measurementSchema,
  measurementTypeEnum,
  measurementUnitEnum,
  type MeasurementFormData,
} from "@/data/measurements";

interface MeasurementFormProps {
  initialData?: Partial<MeasurementFormData>;
  onSubmit: (data: MeasurementFormData) => Promise<void>;
  disableTypeSelection?: boolean;
}

export function MeasurementForm({
  initialData,
  onSubmit,
  disableTypeSelection = false,
}: MeasurementFormProps) {
  const form = useForm<MeasurementFormData>({
    resolver: zodResolver(measurementSchema),
    // Teilvorgaben (z. B. nur der Messpunkt) mit den Standardwerten ergänzen, sonst fehlt
    // die Einheit und das Formular lässt sich nicht absenden.
    defaultValues: {
      type: undefined,
      value: undefined,
      unit: defaultUnitFor(initialData?.type),
      note: "",
      ...initialData,
    },
  });

  const handleSubmit = async (data: MeasurementFormData) => {
    try {
      const cleaned: MeasurementFormData = {
        ...data,
        note: data.note && data.note.trim().length > 0 ? data.note.trim() : undefined,
      };
      await onSubmit(cleaned);
      toast.success("Maße wurden erfolgreich gespeichert");
    } catch (error) {
      console.error("[MeasurementForm] Failed to submit measurement", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Speichern der Maße");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Art des Maßes</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={disableTypeSelection}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Wähle den Messpunkt" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {measurementTypeEnum.options.map((type) => (
                    <SelectItem key={type} value={type}>
                      {MEASUREMENT_TYPE_LABELS[type] ?? type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Wert</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.1"
                    {...field}
                    inputMode="decimal"
                    value={Number.isFinite(field.value) ? field.value : ""}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value === ""
                          ? undefined
                          : parseFloat(event.target.value.replace(",", ".")),
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Einheit</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Wählen Sie eine Einheit" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {measurementUnitEnum.options.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {MEASUREMENT_UNIT_LABELS[unit] ?? unit}
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
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notiz</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormDescription>Optionale Anmerkungen zu diesem Maß</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Wird gespeichert..." : "Speichern"}
        </Button>
      </form>
    </Form>
  );
}

function defaultUnitFor(
  type: MeasurementFormData["type"] | undefined,
): MeasurementFormData["unit"] {
  return type === "SHOE_SIZE" ? "EU" : "CM";
}
