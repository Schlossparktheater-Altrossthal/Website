import type { ReactNode } from "react";

export default function OnboardingDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      {children}
    </section>
  );
}
