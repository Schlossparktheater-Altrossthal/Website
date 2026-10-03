"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateProductAction } from "@/app/(members)/mitglieder/lager/actions/assets";
import { ProductFields } from "@/components/inventory/product-fields";
import { Button } from "@/components/ui/button";
import {
  productPayload,
  type AssetFormArea,
  type ProductFormValues,
} from "@/lib/inventory/asset-form-values";

/** Artikeltyp bearbeiten – Änderungen gelten für alle Exemplare. */
export function ProductForm({
  productId,
  returnHref,
  initialValues,
  areas,
  exemplarCount,
}: {
  productId: string;
  returnHref: string;
  initialValues: ProductFormValues;
  areas: AssetFormArea[];
  exemplarCount: number;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState(initialValues);
  const [saving, setSaving] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const formData = new FormData();
    formData.set("product", JSON.stringify(productPayload(values)));
    try {
      const result = await updateProductAction(productId, formData);
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
        {exemplarCount > 1 ? (
          <p className="rounded-md border border-info/30 bg-info/10 px-3 py-2 text-sm text-foreground">
            Änderungen gelten für alle {exemplarCount} Exemplare dieses Typs.
          </p>
        ) : null}
        <ProductFields values={values} onChange={setValues} areas={areas} mode="edit" />
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
