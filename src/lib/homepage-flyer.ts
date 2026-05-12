import { prisma } from "@/lib/prisma";

export const HOMEPAGE_FLYER_ID = "public";

export async function readHomepageFlyer() {
  return prisma.homepageFlyer.findUnique({ where: { id: HOMEPAGE_FLYER_ID } });
}

export async function saveHomepageFlyer(data: { aktiv: boolean; titel: string | null; beschreibung: string | null }) {
  return prisma.homepageFlyer.upsert({
    where: { id: HOMEPAGE_FLYER_ID },
    update: data,
    create: { id: HOMEPAGE_FLYER_ID, ...data },
  });
}

export async function saveHomepageFlyerImage(data: { bildData: Buffer; bildMimeType: string }) {
  return prisma.homepageFlyer.upsert({
    where: { id: HOMEPAGE_FLYER_ID },
    update: data,
    create: { id: HOMEPAGE_FLYER_ID, ...data },
  });
}

export async function deleteHomepageFlyerImage() {
  return prisma.homepageFlyer.upsert({
    where: { id: HOMEPAGE_FLYER_ID },
    update: { bildData: null, bildMimeType: null },
    create: { id: HOMEPAGE_FLYER_ID, bildData: null, bildMimeType: null },
  });
}
