"use server";

import {
  unsubscribeFromNotificationMails,
  verifyUnsubscribeSignature,
} from "@/lib/email/unsubscribe";

export async function unsubscribeAction(
  _state: { done: boolean; error?: string },
  formData: FormData,
): Promise<{ done: boolean; error?: string }> {
  const userId = String(formData.get("u") ?? "");
  const signature = String(formData.get("s") ?? "");
  if (!userId || !verifyUnsubscribeSignature(userId, signature)) {
    return { done: false, error: "Der Link ist ungültig." };
  }
  const ok = await unsubscribeFromNotificationMails(userId);
  return ok ? { done: true } : { done: false, error: "Konto nicht gefunden." };
}
