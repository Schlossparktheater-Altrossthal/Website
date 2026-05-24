import { defineConfig } from "prisma/config";

// migrate.url is Prisma v7 migrate config; not yet reflected in public PrismaConfig types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineConfig({ migrate: { url: process.env.DATABASE_URL } } as any);
