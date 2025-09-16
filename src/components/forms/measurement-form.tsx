import { MeasurementType, MeasurementUnit } from "@prisma/client"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "sonner"

const measurementSchema = z.object({
  type: z.nativeEnum(MeasurementType),
  value: z.number().min(0),
  unit: z.nativeEnum(MeasurementUnit),
  note: z.string().optional(),
})

type MeasurementFormData = z.infer<typeof measurementSchema>

interface MeasurementFormProps {
  initialData?: MeasurementFormData
  onSubmit: (data: MeasurementFormData) => Promise<void>
}

export function MeasurementForm({ initialData, onSubmit }: MeasurementFormProps) {
  const form = useForm<MeasurementFormData>({
    resolver: zodResolver(measurementSchema),
    defaultValues: initialData || {
      type: undefined,
      value: undefined,
      unit: MeasurementUnit.CM,
      note: "",
    },
  })

  const handleSubmit = async (data: MeasurementFormData) => {
    try {
      await onSubmit(data)
      toast.success("Maße wurden erfolgreich gespeichert")
    } catch (error) {
      toast.error("Fehler beim Speichern der Maße")
    }
  }

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
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Wählen Sie die Art des Maßes" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.values(MeasurementType).map((type) => (
                    <SelectItem key={type} value={type}>
                      {getMeasurementTypeLabel(type)}
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
                    onChange={e => field.onChange(parseFloat(e.target.value))}
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
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Wählen Sie eine Einheit" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.values(MeasurementUnit).map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
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
              <FormDescription>
                Optionale Anmerkungen zu diesem Maß
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Wird gespeichert..." : "Speichern"}
        </Button>
      </form>
    </Form>
  )
}

function getMeasurementTypeLabel(type: MeasurementType): string {
  const labels: Record<MeasurementType, string> = {
    HEIGHT: "Körpergröße",
    CHEST: "Brustumfang",
    WAIST: "Taillenumfang",
    HIPS: "Hüftumfang",
    INSEAM: "Innenbeinlänge",
    SHOULDER: "Schulterbreite",
    SLEEVE: "Armlänge",
    SHOE_SIZE: "Schuhgröße",
    HEAD: "Kopfumfang",
  }
  return labels[type] || type
}