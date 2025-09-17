import { AllergyLevel } from "@prisma/client"
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

const allergySchema = z.object({
  allergen: z.string().min(1, "Allergen ist erforderlich"),
  level: z.nativeEnum(AllergyLevel),
  symptoms: z.string().optional(),
  treatment: z.string().optional(),
  note: z.string().optional(),
})

type AllergyFormData = z.infer<typeof allergySchema>

interface AllergyFormProps {
  initialData?: AllergyFormData
  onSubmit: (data: AllergyFormData) => Promise<void>
}

export function AllergyForm({ initialData, onSubmit }: AllergyFormProps) {
  const form = useForm<AllergyFormData>({
    resolver: zodResolver(allergySchema),
    defaultValues: initialData || {
      allergen: "",
      level: undefined,
      symptoms: "",
      treatment: "",
      note: "",
    },
  })

  const handleSubmit = async (data: AllergyFormData) => {
    try {
      await onSubmit(data)
      toast.success("Allergie/Unverträglichkeit wurde erfolgreich gespeichert")
    } catch (error) {
      console.error("[AllergyForm] Failed to submit allergy", error)
      toast.error("Fehler beim Speichern der Allergie/Unverträglichkeit")
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="allergen"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Allergen/Unverträglichkeit</FormLabel>
              <FormControl>
                <Input {...field} placeholder="z.B. Erdnüsse, Laktose, etc." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="level"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Schweregrad</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Wählen Sie den Schweregrad" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.values(AllergyLevel).map((level) => (
                    <SelectItem key={level} value={level}>
                      {getAllergyLevelLabel(level)}
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
          name="symptoms"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Symptome</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Beschreiben Sie die auftretenden Symptome"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="treatment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Behandlung</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Notwendige Behandlungsschritte im Notfall"
                />
              </FormControl>
              <FormDescription>
                Geben Sie an, wie im Notfall reagiert werden soll
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Zusätzliche Hinweise</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
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

function getAllergyLevelLabel(level: AllergyLevel): string {
  const labels: Record<AllergyLevel, string> = {
    MILD: "Leicht (Unbehagen)",
    MODERATE: "Mittel (Allergische Reaktion)",
    SEVERE: "Schwer (Notfall möglich)",
    LETHAL: "Lebensbedrohlich",
  }
  return labels[level] || level
}