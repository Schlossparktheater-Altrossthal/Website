"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type InventoryItemCategory } from "@prisma/client";
import { z } from "zod";

import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

import {
  TECH_CATEGORY_LABEL,
  TECH_CATEGORY_PREFIX,
  TECH_CATEGORY_VALUES,
  type TechnikInventoryCategory,
} from "./config";

export type TechnikInventoryActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; error: string };

const createItemSchema = z.object({
  category: z.enum(TECH_CATEGORY_VALUES),
  name: z
    .string()
    .trim()
    .min(2, "Bitte eine Modellbezeichnung mit mindestens zwei Zeichen angeben.")
    .max(160, "Die Modellbezeichnung darf höchstens 160 Zeichen enthalten."),
  manufacturer: z
    .string()
    .trim()
    .min(2, "Bitte einen Hersteller mit mindestens zwei Zeichen angeben.")
    .max(120, "Der Hersteller darf höchstens 120 Zeichen enthalten."),
  itemType: z
    .string()
    .trim()
    .min(2, "Bitte einen Typ mit mindestens zwei Zeichen angeben.")
    .max(120, "Der Typ darf höchstens 120 Zeichen enthalten."),
  quantity: z
    .coerce
    .number()
    .int("Die Menge muss eine ganze Zahl sein.")
    .min(0, "Die Menge darf nicht negativ sein."),
  acquisitionCost: z
    .coerce
    .number()
    .min(0, "Die Anschaffungskosten dürfen nicht negativ sein."),
  details: z
    .string()
    .trim()
    .max(500, "Details dürfen höchstens 500 Zeichen enthalten.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  lastUsedAt: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? "")
    .transform((value) => (value ? new Date(`${value}T00:00:00`) : undefined))
    .refine(
      (value) => value === undefined || !Number.isNaN(value.getTime()),
      "Ungültiges Datum für zuletzt benutzt.",
    ),
  purchaseDate: z
    .string()
    .trim()
    .min(1, "Bitte ein Kaufdatum auswählen.")
    .transform((value) => new Date(`${value}T00:00:00`))
    .refine(
      (value) => !Number.isNaN(value.getTime()),
      "Ungültiges Datum für den Kauf.",
    ),
  lastInventoryAt: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? "")
    .transform((value) => (value ? new Date(`${value}T00:00:00`) : undefined))
    .refine(
      (value) => value === undefined || !Number.isNaN(value.getTime()),
      "Ungültiges Datum für die letzte Inventur.",
    ),
});

const updateItemSchema = createItemSchema.extend({
  id: z.string().cuid("Ungültige Inventar-ID."),
});

function calculateTotalValue(quantity: number, acquisitionCost: number): number {
  const raw = quantity * acquisitionCost;

  return Math.round(raw * 100) / 100;
}

async function generateSku(
  client: Prisma.TransactionClient,
  category: TechnikInventoryCategory,
): Promise<string> {
  const prefix = TECH_CATEGORY_PREFIX[category];
  const recent = await client.inventoryItem.findMany({
    where: { category: category as InventoryItemCategory },
    select: { sku: true },
    orderBy: { sku: "desc" },
    take: 20,
  });

  let highest = 0;
  for (const entry of recent) {
    if (!entry.sku.startsWith(prefix)) {
      continue;
    }

    const numericPart = Number.parseInt(entry.sku.slice(prefix.length), 10);
    if (Number.isFinite(numericPart) && numericPart > highest) {
      highest = numericPart;
    }
  }

  const nextValue = highest + 1;
  const digits = nextValue.toString().padStart(3, "0");
  return `${prefix}${digits}`;
}

export async function createTechnikInventoryItem(
  _prevState: TechnikInventoryActionState,
  formData: FormData,
): Promise<TechnikInventoryActionState> {
  try {
    const session = await requireAuth();
    const allowed = await hasPermission(session.user, "mitglieder.lager.technik");

    if (!allowed) {
      throw new Error("Du hast keinen Zugriff auf das Technik-Lager.");
    }

    const parsed = createItemSchema.safeParse({
      category: formData.get("category"),
      name: formData.get("name"),
      manufacturer: formData.get("manufacturer"),
      itemType: formData.get("itemType"),
      quantity: formData.get("quantity"),
      acquisitionCost: formData.get("acquisitionCost"),
      details: formData.get("details") ?? undefined,
      lastUsedAt: formData.get("lastUsedAt") ?? undefined,
      purchaseDate: formData.get("purchaseDate"),
      lastInventoryAt: formData.get("lastInventoryAt") ?? undefined,
    });

    if (!parsed.success) {
      const firstError = parsed.error.issues.at(0)?.message ?? "Ungültige Eingabe.";
      return { status: "error", error: firstError };
    }

    const values = parsed.data;
    const totalValue = calculateTotalValue(values.quantity, values.acquisitionCost);

    const result = await prisma.$transaction(async (tx) => {
      const sku = await generateSku(tx, values.category);

      const item = await tx.inventoryItem.create({
        data: {
          name: values.name,
          manufacturer: values.manufacturer,
          itemType: values.itemType,
          qty: values.quantity,
          acquisitionCost: values.acquisitionCost,
          totalValue,
          purchaseDate: values.purchaseDate,
          details: values.details ?? null,
          sku,
          category: values.category as InventoryItemCategory,
          lastUsedAt: values.lastUsedAt ?? null,
          lastInventoryAt: values.lastInventoryAt ?? null,
        },
        select: { id: true, sku: true },
      });

      return item;
    });

    revalidatePath("/mitglieder/lagerverwaltung/technik");

    const label = TECH_CATEGORY_LABEL[values.category];
    return {
      status: "success",
      message: `Artikel ${result.sku} (${label}) wurde angelegt.`,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Der Artikel konnte nicht angelegt werden.";
    return { status: "error", error: message };
  }
}

export async function updateTechnikInventoryItem(
  _prevState: TechnikInventoryActionState,
  formData: FormData,
): Promise<TechnikInventoryActionState> {
  try {
    const session = await requireAuth();
    const allowed = await hasPermission(session.user, "mitglieder.lager.technik");

    if (!allowed) {
      throw new Error("Du hast keinen Zugriff auf das Technik-Lager.");
    }

    const parsed = updateItemSchema.safeParse({
      id: formData.get("id"),
      category: formData.get("category"),
      name: formData.get("name"),
      manufacturer: formData.get("manufacturer"),
      itemType: formData.get("itemType"),
      quantity: formData.get("quantity"),
      acquisitionCost: formData.get("acquisitionCost"),
      details: formData.get("details") ?? undefined,
      lastUsedAt: formData.get("lastUsedAt") ?? undefined,
      purchaseDate: formData.get("purchaseDate"),
      lastInventoryAt: formData.get("lastInventoryAt") ?? undefined,
    });

    if (!parsed.success) {
      const firstError = parsed.error.issues.at(0)?.message ?? "Ungültige Eingabe.";
      return { status: "error", error: firstError };
    }

    const values = parsed.data;
    const totalValue = calculateTotalValue(values.quantity, values.acquisitionCost);

    await prisma.inventoryItem.update({
      where: { id: values.id },
      data: {
        name: values.name,
        manufacturer: values.manufacturer,
        itemType: values.itemType,
        qty: values.quantity,
        acquisitionCost: values.acquisitionCost,
        totalValue,
        purchaseDate: values.purchaseDate,
        details: values.details ?? null,
        category: values.category as InventoryItemCategory,
        lastUsedAt: values.lastUsedAt ?? null,
        lastInventoryAt: values.lastInventoryAt ?? null,
      },
    });

    revalidatePath("/mitglieder/lagerverwaltung/technik");

    const label = TECH_CATEGORY_LABEL[values.category];
    return {
      status: "success",
      message: `Artikel wurde aktualisiert (${label}).`,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Der Artikel konnte nicht aktualisiert werden.";
    return { status: "error", error: message };
  }
}
