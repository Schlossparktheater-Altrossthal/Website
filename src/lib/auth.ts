import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { NextAuthOptions } from "next-auth";
import type { Role } from "@prisma/client";
import EmailProvider from "next-auth/providers/email";
import Credentials from "next-auth/providers/credentials";

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
            credentials: { email: { label: "Email", type: "email" } },
            async authorize(credentials) {
              const email = credentials?.email?.toString().toLowerCase();
              if (!email) return null;
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
              return { id: user.id, email: user.email!, name: user.name!, role: user.role };
            },
          }),
        ]
      : []),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      // On first sign in, persist id/role into the token
      if (user) {
        (token as any).id = (user as any).id;
        (token as any).role = (user as any).role;
      }
      
      // If role is missing, refresh it from database
      if (token.id && !(token as any).role) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true }
        });
        if (dbUser) {
          (token as any).role = dbUser.role;
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token as any).id as string;
        session.user.role = (token as any).role as Role | undefined;
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
};
