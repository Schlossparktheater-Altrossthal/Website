import { AvatarSource, Role } from "@prisma/client";
// augment next-auth types for session.user

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      role?: Role;
      roles?: Role[];
      avatarSource?: AvatarSource | null;
      avatarUpdatedAt?: string | null;
      dateOfBirth?: string | null;
    };
  }
  interface User {
    role?: Role;
    roles?: Role[];
    avatarSource?: AvatarSource | null;
    avatarUpdatedAt?: string | null;
    dateOfBirth?: string | null;
  }
}

export {};
