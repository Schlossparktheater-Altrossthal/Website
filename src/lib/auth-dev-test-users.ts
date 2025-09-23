import { ROLE_LABELS, type Role } from "@/lib/roles";

export type DevTestUser = {
  email: string;
  role: Role;
  label: string;
};

export const DEV_TEST_USERS: DevTestUser[] = [
  { email: "member@example.com", role: "member", label: ROLE_LABELS.member },
  { email: "cast@example.com", role: "cast", label: ROLE_LABELS.cast },
  { email: "tech@example.com", role: "tech", label: ROLE_LABELS.tech },
  { email: "board@example.com", role: "board", label: ROLE_LABELS.board },
  { email: "finance@example.com", role: "finance", label: ROLE_LABELS.finance },
  { email: "admin@example.com", role: "admin", label: ROLE_LABELS.admin },
  { email: "owner@example.com", role: "owner", label: ROLE_LABELS.owner },
];

export const DEV_TEST_USER_EMAILS = DEV_TEST_USERS.map((user) => user.email);

export const DEV_TEST_USER_ROLE_MAP: Record<string, Role> = DEV_TEST_USERS.reduce(
  (acc, user) => {
    acc[user.email] = user.role;
    return acc;
  },
  {} as Record<string, Role>,
);
