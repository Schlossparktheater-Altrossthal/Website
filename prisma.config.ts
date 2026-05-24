import { defineConfig } from "prisma/config";

// datasource.url is required by prisma migrate deploy in Prisma v7;
// not yet reflected in PrismaConfig types, hence the cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineConfig({ datasource: { url: process.env.DATABASE_URL } } as any);
