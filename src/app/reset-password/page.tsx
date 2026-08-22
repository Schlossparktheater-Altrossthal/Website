import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Neues Passwort festlegen</h1>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
