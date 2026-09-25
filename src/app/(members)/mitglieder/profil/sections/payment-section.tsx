"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { FormSaveBar } from "@/components/ui/form-save-bar";
import { Input } from "@/components/ui/input";
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
import { ProfileField } from "./profile-fieldset";

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

  const storedState: PaymentFormState = {
    payoutMethod: user.payoutMethod,
    payoutAccountHolder: user.payoutAccountHolder ?? "",
    payoutIban: user.payoutIban ?? "",
    payoutBankName: user.payoutBankName ?? "",
    payoutPaypalHandle: user.payoutPaypalHandle ?? "",
    payoutNote: user.payoutNote ?? "",
  };
  const dirty = JSON.stringify(formState) !== JSON.stringify(storedState);

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
    <Card variant="plain" size="md">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <p id="payout-method-label" className="text-sm font-medium text-foreground">
            Auszahlung per
          </p>
          <div
            role="radiogroup"
            aria-labelledby="payout-method-label"
            className="grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-1 sm:inline-grid"
          >
            {PAYOUT_METHOD_OPTIONS.map((option) => {
              const active = formState.payoutMethod === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => handlePayoutMethodChange(option.value)}
                  className={cn(
                    "min-h-9 rounded-md px-3 text-sm font-medium transition",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.value === "BANK_TRANSFER"
                    ? "Überweisung"
                    : option.value === "OTHER"
                      ? "Anders"
                      : option.label}
                </button>
              );
            })}
          </div>
          {fieldErrors.payoutMethod ? (
            <p className="text-xs text-destructive">{fieldErrors.payoutMethod}</p>
          ) : null}
        </div>

        {formState.payoutMethod === "BANK_TRANSFER" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <ProfileField
              label="IBAN"
              htmlFor="payoutIban"
              error={fieldErrors.payoutIban}
              className="sm:col-span-2"
            >
              <Input
                id="payoutIban"
                name="payoutIban"
                value={formState.payoutIban}
                onChange={handleInputChange}
                autoComplete="off"
                inputMode="text"
                placeholder="DE00 0000 0000 0000 0000 00"
              />
            </ProfileField>
            <ProfileField
              label="Kontoinhaber"
              htmlFor="payoutAccountHolder"
              error={fieldErrors.payoutAccountHolder}
            >
              <Input
                id="payoutAccountHolder"
                name="payoutAccountHolder"
                value={formState.payoutAccountHolder}
                onChange={handleInputChange}
                autoComplete="name"
              />
            </ProfileField>
            <ProfileField label="Bank" htmlFor="payoutBankName" error={fieldErrors.payoutBankName}>
              <Input
                id="payoutBankName"
                name="payoutBankName"
                value={formState.payoutBankName}
                onChange={handleInputChange}
                autoComplete="organization"
              />
            </ProfileField>
          </div>
        ) : null}

        {formState.payoutMethod === "PAYPAL" ? (
          <ProfileField
            label="PayPal-Adresse"
            htmlFor="payoutPaypalHandle"
            error={fieldErrors.payoutPaypalHandle}
            hint="E-Mail-Adresse oder PayPal.me-Link."
          >
            <Input
              id="payoutPaypalHandle"
              name="payoutPaypalHandle"
              value={formState.payoutPaypalHandle}
              onChange={handleInputChange}
              placeholder="name@example.com"
              autoComplete="off"
            />
          </ProfileField>
        ) : null}

        {formState.payoutMethod === "OTHER" ? (
          <ProfileField
            label="Wie sollen wir dir Geld senden?"
            htmlFor="payoutNote"
            error={fieldErrors.payoutNote}
            hint="Zum Beispiel Revolut oder Wise."
          >
            <Textarea
              id="payoutNote"
              name="payoutNote"
              value={formState.payoutNote}
              onChange={handleInputChange}
              rows={2}
            />
          </ProfileField>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <FormSaveBar
          dirty={dirty}
          submitting={submitting}
          onReset={() => {
            setFormState(storedState);
            setFieldErrors({});
            setError(null);
          }}
        />
      </form>
    </Card>
  );
}
