import { vi } from "vitest";

import { itState } from "./harness";

// Echte Datenbank, echte Rechteprüfung. Ersetzt wird nur, was außerhalb der App liegt:
// Login (Authentik), Mailversand, Authentik-Gruppen, Next-Laufzeit (Cache, Cookies), Realtime.
vi.mock("@/auth", () => ({ auth: async () => itState.session }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      itState.cookies.has(name) ? { name, value: itState.cookies.get(name) } : undefined,
    set: (name: string, value: string) => void itState.cookies.set(name, value),
    delete: (name: string) => void itState.cookies.delete(name),
    has: (name: string) => itState.cookies.has(name),
    getAll: () => [...itState.cookies].map(([name, value]) => ({ name, value })),
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/email/send", () => ({
  createConfiguredMailSender: async () =>
    itState.mailEnabled
      ? async (mail: { to: string; subject: string; text: string }) => {
          itState.mails.push(mail);
        }
      : null,
}));
vi.mock("@/lib/authentik/service-groups", () => ({ requestServiceGroupSync: vi.fn() }));
vi.mock("@/lib/authentik/migration", () => ({
  migratePasswordToAuthentik: async () => ({ status: "skipped", reason: "disabled" }),
}));
vi.mock("@/lib/onboarding/dashboard-events", () => ({
  broadcastOnboardingDashboardSnapshot: vi.fn(),
  broadcastOnboardingDashboardForUser: vi.fn(),
}));
