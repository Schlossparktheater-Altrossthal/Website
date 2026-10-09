import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

function createQueryLoggingClient(adapter: PrismaPg): PrismaClient {
  const client = new PrismaClient({
    adapter,
    log: [{ emit: "event", level: "query" }, "error", "warn"],
  });
  client.$on("query", (event) => {
    console.debug(`[prisma] ${event.duration}ms ${event.query.replace(/\s+/g, " ").slice(0, 160)}`);
  });
  return client;
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set.");
    }

    if (!globalForPrisma.pgPool) {
      globalForPrisma.pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
    }

    const adapter = new PrismaPg(globalForPrisma.pgPool);
    // PRISMA_QUERY_LOG=1: jede Abfrage mit Dauer loggen (zum Profilieren langsamer Seiten)
    globalForPrisma.prisma =
      process.env.PRISMA_QUERY_LOG === "1"
        ? createQueryLoggingClient(adapter)
        : new PrismaClient({ adapter, log: ["error", "warn"] });
  }

  return globalForPrisma.prisma;
}

export const prisma = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getPrismaClient();
      const value = (client as PrismaClient)[prop as keyof PrismaClient];
      if (typeof value === "function") {
        return (value as (...args: unknown[]) => unknown).bind(client);
      }
      return value;
    },
  },
) as PrismaClient;
