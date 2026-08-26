"use server";

import type { PayoutMethod } from "@prisma/client";

import { authorizedFetch, type ActionResult } from "./helpers";

export type UpdateProfileBasicsResult = {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    email: string;
    roles: string[];
    avatarSource: string | null;
    avatarUpdatedAt: string | null;
    dateOfBirth: string | null;
    payoutMethod: PayoutMethod;
    payoutAccountHolder: string | null;
    payoutIban: string | null;
    payoutBankName: string | null;
    payoutPaypalHandle: string | null;
    payoutNote: string | null;
  };
};

const PAYOUT_METHOD_VALUES = [
  "BANK_TRANSFER",
  "PAYPAL",
  "OTHER",
] as const satisfies readonly PayoutMethod[];

export async function updateProfileBasicsAction(
  formData: FormData,
): Promise<ActionResult<UpdateProfileBasicsResult>> {
  try {
    const response = await authorizedFetch("/api/profile", {
      method: "PUT",
      body: formData,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error =
        typeof data?.error === "string" ? data.error : "Profil konnte nicht aktualisiert werden.";
      return { ok: false, error };
    }

    const user = data?.user;
    if (!user || typeof user !== "object") {
      return { ok: false, error: "Antwort des Servers war ungültig." };
    }

    return {
      ok: true,
      data: {
        user: {
          id: String(user.id ?? ""),
          firstName: typeof user.firstName === "string" ? user.firstName : null,
          lastName: typeof user.lastName === "string" ? user.lastName : null,
          name: typeof user.name === "string" ? user.name : null,
          email: typeof user.email === "string" ? user.email : "",
          roles: Array.isArray(user.roles)
            ? (user.roles as unknown[])
                .map((role) =>
                  typeof role === "string"
                    ? role
                    : role &&
                        typeof role === "object" &&
                        typeof (role as { role?: unknown }).role === "string"
                      ? (role as { role: string }).role
                      : null,
                )
                .filter((role): role is string => Boolean(role))
            : [],
          avatarSource:
            typeof user.avatarSource === "string" && user.avatarSource.trim()
              ? user.avatarSource
              : null,
          avatarUpdatedAt:
            typeof user.avatarUpdatedAt === "string" && user.avatarUpdatedAt.trim()
              ? user.avatarUpdatedAt
              : null,
          dateOfBirth:
            typeof user.dateOfBirth === "string" && user.dateOfBirth.trim()
              ? user.dateOfBirth
              : null,
          payoutMethod:
            typeof user.payoutMethod === "string" &&
            PAYOUT_METHOD_VALUES.includes(user.payoutMethod as PayoutMethod)
              ? (user.payoutMethod as PayoutMethod)
              : "BANK_TRANSFER",
          payoutAccountHolder:
            typeof user.payoutAccountHolder === "string" && user.payoutAccountHolder.trim()
              ? user.payoutAccountHolder
              : null,
          payoutIban:
            typeof user.payoutIban === "string" && user.payoutIban.trim() ? user.payoutIban : null,
          payoutBankName:
            typeof user.payoutBankName === "string" && user.payoutBankName.trim()
              ? user.payoutBankName
              : null,
          payoutPaypalHandle:
            typeof user.payoutPaypalHandle === "string" && user.payoutPaypalHandle.trim()
              ? user.payoutPaypalHandle
              : null,
          payoutNote:
            typeof user.payoutNote === "string" && user.payoutNote.trim() ? user.payoutNote : null,
        },
      },
    };
  } catch (error) {
    console.error("[profile][basics]", error);
    return { ok: false, error: "Netzwerkfehler: Profil konnte nicht aktualisiert werden." };
  }
}
