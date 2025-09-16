import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { useState } from "react"

interface EmergencyDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (reason: string) => Promise<void>
}

export function EmergencyDialog({ isOpen, onClose, onSubmit }: EmergencyDialogProps) {
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Bitte geben Sie einen Grund für die Emergency-Absage an")
      return
    }

    try {
      setIsSubmitting(true)
      await onSubmit(reason)
      toast.success("Emergency-Absage wurde erfolgreich registriert")
      onClose()
    } catch (error) {
      toast.error("Fehler beim Registrieren der Emergency-Absage")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Emergency-Absage</DialogTitle>
          <DialogDescription>
            Bitte geben Sie einen triftigen Grund für die kurzfristige Absage an.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="reason">Begründung</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="z.B. Krankheit, familiärer Notfall, etc."
              className="min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Abbrechen
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
          >
            {isSubmitting ? "Wird gesendet..." : "Absagen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}