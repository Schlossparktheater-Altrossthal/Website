"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateAssetAction } from "@/app/(members)/mitglieder/lager/actions/assets";
import { ConditionSelect, ExemplarFields } from "@/components/inventory/exemplar-fields";
import { Button } from "@/components/ui/button";
import { exemplarPayload, type ExemplarFormValues } from "@/lib/inventory/asset-form-values";

/** Ein einzelnes Exemplar bearbeiten; Typ-Angaben ändert man auf der Typ-Seite. */
export function ExemplarForm({
  assetId,
  returnHref,
  productHref,
  productName,
  initialValues,
  inspectionRequired,
  canManage,
}: {
  assetId: string;
  returnHref: string;
  productHref: string;
  productName: string;
  initialValues: ExemplarFormValues;
  inspectionRequired: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState(initialValues);
  const [saving, setSaving] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const formData = new FormData();
    formData.set("asset", JSON.stringify(exemplarPayload(values)));
    try {
      const result = await updateAssetAction(assetId, formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Gespeichert.");
      router.push(returnHref);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <p className="text-sm text-muted-foreground">
          Name, Hersteller, Merkmale und Prüfpflicht gehören zum Artikeltyp{" "}
          <Link
            href={`${productHref}/bearbeiten`}
            className="font-medium text-primary hover:underline"
          >
            „{productName}“ bearbeiten
          </Link>
          .
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ConditionSelect
            value={values.condition}
            onChange={(condition) => setValues({ ...values, condition })}
          />
        </div>
        <ExemplarFields
          values={values}
          onChange={setValues}
          single
          inspectionRequired={inspectionRequired}
          canManage={canManage}
        />
      </section>
      <div className="sticky bottom-[var(--members-bottom-nav,0px)] z-10 -mx-1 flex gap-2 bg-background/95 px-1 py-3 backdrop-blur">
        <Button type="submit" size="lg" disabled={saving} className="flex-1 sm:flex-none">
          {saving ? "Speichert …" : "Speichern"}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
