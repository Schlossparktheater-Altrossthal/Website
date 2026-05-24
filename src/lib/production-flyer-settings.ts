import { prisma } from "@/lib/prisma";

export const PRODUCTION_FLYER_SETTINGS_ID = "public";

export async function readProductionFlyerSettings() {
  return prisma.homepageFlyer.findUnique({ where: { id: PRODUCTION_FLYER_SETTINGS_ID } });
}

export async function saveProductionFlyerSettings(data: { aktiv: boolean; titel: string | null; beschreibung: string | null }) {
  return prisma.homepageFlyer.upsert({
    where: { id: PRODUCTION_FLYER_SETTINGS_ID },
    update: data,
    create: { id: PRODUCTION_FLYER_SETTINGS_ID, ...data },
  });
}

export async function saveProductionFlyerSettingsImage(data: { bildData: Buffer; bildMimeType: string }) {
  return prisma.homepageFlyer.upsert({
    where: { id: PRODUCTION_FLYER_SETTINGS_ID },
    update: data,
    create: { id: PRODUCTION_FLYER_SETTINGS_ID, ...data },
  });
}

export async function deleteProductionFlyerSettingsImage() {
  return prisma.homepageFlyer.upsert({
    where: { id: PRODUCTION_FLYER_SETTINGS_ID },
    update: { bildData: null, bildMimeType: null },
    create: { id: PRODUCTION_FLYER_SETTINGS_ID, bildData: null, bildMimeType: null },
  });
}
