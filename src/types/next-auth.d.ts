import { AvatarSource, Role } from "@prisma/client";
import type { ImpersonationDetails } from "@/lib/auth/impersonation";
// augment next-auth types for session.user

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      name?: string | null;
      email?: string | null;
      role?: Role;
      roles?: Role[];
      avatarSource?: AvatarSource | null;
      avatarUpdatedAt?: string | null;
      dateOfBirth?: string | null;
      isDeactivated?: boolean;
      deactivatedAt?: string | null;
    };
    analyticsSessionId?: string | null;
    impersonation?: ImpersonationDetails | null;
  }
  interface User {
    firstName?: string | null;
    lastName?: string | null;
    role?: Role;
    roles?: Role[];
    avatarSource?: AvatarSource | null;
    avatarUpdatedAt?: string | null;
    dateOfBirth?: string | null;
    isDeactivated?: boolean;
    deactivatedAt?: string | null;
  }
}

export {};
