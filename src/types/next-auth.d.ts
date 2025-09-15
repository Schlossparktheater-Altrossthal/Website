import { Role } from "@prisma/client";
// augment next-auth types for session.user

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      role?: Role;
    };
  }
  interface User {
    role?: Role;
  }
}

export {};
