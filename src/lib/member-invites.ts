import { createHash, randomBytes } from "node:crypto";

import type { MemberInvite } from "@prisma/client";

const DEFAULT_TOKEN_BYTES = 24;

export function generateInviteToken(byteLength: number = DEFAULT_TOKEN_BYTES) {
  const size = Number.isFinite(byteLength) && byteLength > 0 ? Math.floor(byteLength) : DEFAULT_TOKEN_BYTES;
  return randomBytes(size).toString("base64url");
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

type InviteLike = Pick<MemberInvite, "expiresAt" | "maxUses" | "usageCount" | "isDisabled">;

export function calculateInviteStatus(invite: InviteLike, now: Date = new Date()) {
  const expiresAt = invite.expiresAt ? new Date(invite.expiresAt) : null;
  const isExpired = Boolean(expiresAt && expiresAt.getTime() <= now.getTime());
  const isExhausted = typeof invite.maxUses === "number" && invite.maxUses > -1
    ? invite.usageCount >= invite.maxUses
    : false;
  const remainingUses = typeof invite.maxUses === "number" && invite.maxUses > -1
    ? Math.max(invite.maxUses - invite.usageCount, 0)
    : null;
  const isDisabled = invite.isDisabled;
  const isActive = !isDisabled && !isExpired && !isExhausted;

  return { isExpired, isExhausted, isDisabled, isActive, remainingUses };
}

export function isInviteUsable(invite: InviteLike, now: Date = new Date()) {
  const status = calculateInviteStatus(invite, now);
  return status.isActive;
}

export function describeInvite(invite: MemberInvite, now: Date = new Date()) {
  const status = calculateInviteStatus(invite, now);
  return {
    id: invite.id,
    label: invite.label,
    note: invite.note,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    maxUses: invite.maxUses,
    usageCount: invite.usageCount,
    roles: invite.roles,
    ...status,
  };
}
