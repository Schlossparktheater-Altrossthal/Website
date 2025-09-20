import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export function hashOwnerSetupToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

type SupportedClient = PrismaClient | Prisma.TransactionClient;

export async function ownerExists(client: SupportedClient = prisma) {
  const count = await client.user.count({
    where: {
      OR: [{ role: "owner" }, { roles: { some: { role: "owner" } } }],
    },
  });
  return count > 0;
}
