import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { NextAuthOptions } from "next-auth";
import type { Role } from "@prisma/client";
import EmailProvider from "next-auth/providers/email";
import Credentials from "next-auth/providers/credentials";
import { sortRoles } from "@/lib/roles";
import { verifyPassword } from "@/lib/password";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  // Use JWT sessions for reliability in dev (works with Credentials + Email).
  session: { strategy: "jwt" },
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
      async sendVerificationRequest({ identifier, url }) {
        if (!process.env.EMAIL_SERVER || process.env.NODE_ENV !== "production") {
          console.log("[DEV Magic Link]", identifier, url);
        }
      },
    }),
    ...(process.env.NODE_ENV !== "production"
      ? [
          Credentials({
            name: "Test Login",
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Passwort", type: "password" },
              dev: { label: "Dev", type: "text" },
            },
            async authorize(credentials) {
              const email = credentials?.email?.toString().toLowerCase();
              const password = credentials?.password?.toString();
              const devFastLogin =
                process.env.NODE_ENV !== "production" && credentials?.dev === "1";

              if (!email) return null;

              if (devFastLogin) {
                const allowed = [
                  "member@example.com",
                  "cast@example.com",
                  "tech@example.com",
                  "board@example.com",
                  "finance@example.com",
                  "admin@example.com",
                ];
                if (!allowed.includes(email)) return null;
                const roleMap: Record<string, Role> = {
                  "member@example.com": "member",
                  "cast@example.com": "cast",
                  "tech@example.com": "tech",
                  "board@example.com": "board",
                  "finance@example.com": "finance_admin",
                  "admin@example.com": "admin",
                };
                const user = await prisma.user.upsert({
                  where: { email },
                  update: {},
                  create: { email, name: email.split("@")[0], role: roleMap[email] },
                });
                await prisma.userRole.upsert({
                  where: { userId_role: { userId: user.id, role: roleMap[email] } },
                  update: {},
                  create: { userId: user.id, role: roleMap[email] },
                });
                return {
                  id: user.id,
                  email: user.email!,
                  name: user.name!,
                  role: user.role,
                  roles: [user.role],
                };
              }

              if (!password) {
                throw new Error("Passwort erforderlich");
              }

              const user = await prisma.user.findUnique({
                where: { email },
                include: { roles: true },
              });

              if (!user || !user.passwordHash) {
                throw new Error("Ungültige Zugangsdaten");
              }

              const valid = await verifyPassword(password, user.passwordHash);
              if (!valid) {
                throw new Error("Ungültige Zugangsdaten");
              }

              const combinedRoles = sortRoles([
                user.role as Role,
                ...user.roles.map((r) => r.role as Role),
              ]);

              return {
                id: user.id,
                email: user.email!,
                name: user.name!,
                role: combinedRoles[0],
                roles: combinedRoles,
              };
            },
          }),
        ]
      : []),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      const setFromList = (roles?: Role[]) => {
        if (roles && roles.length > 0) {
          const sorted = sortRoles(roles);
          (token as any).roles = sorted;
          (token as any).role = sorted[0];
        }
      };

      if (user) {
        (token as any).id = (user as any).id;
        setFromList((user as any).roles || ((user as any).role ? [(user as any).role as Role] : undefined));
      }

      const userId = (token as any).id as string | undefined;
      if (userId && !(token as any).roles) {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true, roles: { select: { role: true } } },
        });
        if (dbUser) {
          const combined = [dbUser.role, ...dbUser.roles.map((r) => r.role)];
          setFromList(combined as Role[]);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token as any).id as string;
        session.user.role = (token as any).role as Role | undefined;
        const roles = (token as any).roles as Role[] | undefined;
        if (roles) {
          session.user.roles = roles;
        }
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
};
