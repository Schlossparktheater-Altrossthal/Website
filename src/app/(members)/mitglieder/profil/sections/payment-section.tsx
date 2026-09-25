"use client";

import { Loader2Icon } from "@/components/ui/action-icons";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type PayoutMethod } from "@prisma/client";
import { updateProfileBasicsAction } from "../actions/basics";
import {
  PAYOUT_METHOD_OPTIONS,
  ProfileUser,
  mapUpdatedUserFromPayload,
  PaymentFormState,
  payoutDetailsSchema,
} from "../profile-shared";

type PaymentSectionProps = {
  user: ProfileUser;
  onUserUpdated: (nextUser: ProfileUser) => Promise<void> | void;
};

export function PaymentSection({ user, onUserUpdated }: PaymentSectionProps) {
  const [formState, setFormState] = useState<PaymentFormState>(() => ({
    payoutMethod: user.payoutMethod,
    payoutAccountHolder: user.payoutAccountHolder ?? "",
    payoutIban: user.payoutIban ?? "",
    payoutBankName: user.payoutBankName ?? "",
    payoutPaypalHandle: user.payoutPaypalHandle ?? "",
    payoutNote: user.payoutNote ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setFormState({
      payoutMethod: user.payoutMethod,
      payoutAccountHolder: user.payoutAccountHolder ?? "",
      payoutIban: user.payoutIban ?? "",
      payoutBankName: user.payoutBankName ?? "",
      payoutPaypalHandle: user.payoutPaypalHandle ?? "",
      payoutNote: user.payoutNote ?? "",
    });
  }, [
    user.payoutMethod,
    user.payoutAccountHolder,
    user.payoutIban,
    user.payoutBankName,
    user.payoutPaypalHandle,
    user.payoutNote,
  ]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    const nextValue = name === "payoutIban" ? value.replace(/\s+/g, "").toUpperCase() : value;
    setFormState((prev) => ({ ...prev, [name]: nextValue }));
  };

  const handlePayoutMethodChange = (value: PayoutMethod) => {
    setFormState((prev) => ({ ...prev, payoutMethod: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const parseResult = payoutDetailsSchema.safeParse(formState);
    if (!parseResult.success) {
      const issues = parseResult.error.flatten();
      const fieldIssueEntries = Object.entries(issues.fieldErrors).filter(
        ([, messages]) => messages && messages.length > 0,
      );
      if (fieldIssueEntries.length > 0) {
        setFieldErrors(
          Object.fromEntries(fieldIssueEntries.map(([key, messages]) => [key, messages![0]])),
        );
      }
      if (issues.formErrors.length) {
        setError(issues.formErrors[0]);
      }
      return;
    }

    const data = parseResult.data;
    setFormState(data);

    const formData = new FormData();
    formData.append("payoutMethod", data.payoutMethod);
    formData.append("payoutAccountHolder", data.payoutAccountHolder);
    formData.append("payoutIban", data.payoutIban);
    formData.append("payoutBankName", data.payoutBankName);
    formData.append("payoutPaypalHandle", data.payoutPaypalHandle);
    formData.append("payoutNote", data.payoutNote);

    setSubmitting(true);
    try {
      const result = await updateProfileBasicsAction(formData);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      const payload = result.data.user;
      const nextUser = mapUpdatedUserFromPayload(user, payload);
      await onUserUpdated(nextUser);
      setFormState({
        payoutMethod: payload.payoutMethod,
        payoutAccountHolder: payload.payoutAccountHolder ?? "",
        payoutIban: payload.payoutIban ?? "",
        payoutBankName: payload.payoutBankName ?? "",
        payoutPaypalHandle: payload.payoutPaypalHandle ?? "",
        payoutNote: payload.payoutNote ?? "",
      });
      toast.success("Zahlungsdaten aktualisiert");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Zahlungsdaten</CardTitle>
        <p className="text-sm text-muted-foreground">
          Hinterlege hier, wie wir Auslagen erstatten oder Gagen auszahlen sollen.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="payoutMethod">Bevorzugte Auszahlung</Label>
            <Select
              value={formState.payoutMethod}
              onValueChange={(value) => handlePayoutMethodChange(value as PayoutMethod)}
            >
              <SelectTrigger id="payoutMethod">
                <SelectValue placeholder="Auszahlungsart wählen" />
              </SelectTrigger>
              <SelectContent>
                {PAYOUT_METHOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.payoutMethod ? (
              <p className="text-sm text-destructive">{fieldErrors.payoutMethod}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Diese Angaben nutzen wir, um dir Auslagen zu erstatten oder Gagen auszuzahlen.
            </p>
          </div>

          {formState.payoutMethod === "BANK_TRANSFER" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="payoutAccountHolder">Kontoinhaber</Label>
                <Input
                  id="payoutAccountHolder"
                  name="payoutAccountHolder"
                  value={formState.payoutAccountHolder}
                  onChange={handleInputChange}
                  autoComplete="name"
                />
                {fieldErrors.payoutAccountHolder ? (
                  <p className="text-sm text-destructive">{fieldErrors.payoutAccountHolder}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="payoutBankName">Bank</Label>
                <Input
                  id="payoutBankName"
                  name="payoutBankName"
                  value={formState.payoutBankName}
                  onChange={handleInputChange}
                  autoComplete="organization"
                />
                {fieldErrors.payoutBankName ? (
                  <p className="text-sm text-destructive">{fieldErrors.payoutBankName}</p>
                ) : null}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="payoutIban">IBAN</Label>
                <Input
                  id="payoutIban"
                  name="payoutIban"
                  value={formState.payoutIban}
                  onChange={handleInputChange}
                  autoComplete="off"
                />
                {fieldErrors.payoutIban ? (
                  <p className="text-sm text-destructive">{fieldErrors.payoutIban}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Wir speichern die IBAN ohne Leerzeichen.
                </p>
              </div>
            </div>
          ) : null}

          {formState.payoutMethod === "PAYPAL" ? (
            <div className="space-y-2">
              <Label htmlFor="payoutPaypalHandle">PayPal-Adresse</Label>
              <Input
                id="payoutPaypalHandle"
                name="payoutPaypalHandle"
                value={formState.payoutPaypalHandle}
                onChange={handleInputChange}
                placeholder="paypal@example.com oder https://paypal.me/deinname"
                autoComplete="off"
              />
              {fieldErrors.payoutPaypalHandle ? (
                <p className="text-sm text-destructive">{fieldErrors.payoutPaypalHandle}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Nutze deine PayPal-E-Mail-Adresse oder einen PayPal.me-Link.
              </p>
            </div>
          ) : null}

          {formState.payoutMethod === "OTHER" ? (
            <div className="space-y-2">
              <Label htmlFor="payoutNote">Auszahlungsdetails</Label>
              <Textarea
                id="payoutNote"
                name="payoutNote"
                value={formState.payoutNote}
                onChange={handleInputChange}
                rows={3}
                placeholder="Beschreibe kurz, wie wir dir Geld senden sollen."
              />
              {fieldErrors.payoutNote ? (
                <p className="text-sm text-destructive">{fieldErrors.payoutNote}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Zum Beispiel Revolut, Wise oder andere Konten.
              </p>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-col items-stretch justify-end gap-3 sm:flex-row sm:items-center">
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Speichern…
                </>
              ) : (
                "Zahlungsdaten speichern"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
