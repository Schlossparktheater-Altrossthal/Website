import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CURRENT_PRIVACY_POLICY,
  PRIVACY_POLICY_VERSIONS,
  findPrivacyPolicyVersion,
  isPrivacyPolicyEnabled,
} from "@/lib/datenschutz/policy";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { DEFAULT_SITE_TITLE } from "@/lib/website-settings";

export const metadata: Metadata = {
  title: `Datenschutz Mitgliederbereich · ${DEFAULT_SITE_TITLE}`,
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "long",
  timeZone: DEFAULT_TIME_ZONE,
});

/** Datenschutzerklärung des Mitgliederbereichs, ohne Login; `/datenschutz/<version>` für alte Fassungen. */
export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ version?: string[] }>;
}) {
  if (!isPrivacyPolicyEnabled()) notFound();
  const { version } = await params;
  if (version && version.length > 1) notFound();
  const policy = version ? findPrivacyPolicyVersion(version[0]) : CURRENT_PRIVACY_POLICY;
  if (!policy) notFound();
  const isCurrent = policy.version === CURRENT_PRIVACY_POLICY.version;

  return (
    <main id="main" className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Datenschutzerklärung Mitgliederbereich</h1>
        <p className="text-sm text-muted-foreground">
          Fassung {policy.version}, gültig ab {dateFormat.format(new Date(policy.validFrom))}
          {isCurrent ? "" : " (nicht mehr aktuell)"}
        </p>
        {!isCurrent && (
          <Link
            href="/datenschutz"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Zur aktuellen Fassung
          </Link>
        )}
      </header>
      {policy.sections.map((section) => (
        <section key={section.heading} className="space-y-2">
          <h2 className="text-lg font-semibold">{section.heading}</h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph} className="leading-relaxed">
              {paragraph}
            </p>
          ))}
          {section.items && (
            <ul className="list-disc space-y-1 pl-5 leading-relaxed">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {PRIVACY_POLICY_VERSIONS.length > 1 && (
        <footer className="space-y-1 border-t border-border/60 pt-4 text-sm text-muted-foreground">
          <p>Frühere Fassungen:</p>
          <ul className="flex flex-wrap gap-3">
            {PRIVACY_POLICY_VERSIONS.map((entry) => (
              <li key={entry.version}>
                <Link href={`/datenschutz/${entry.version}`} className="hover:text-foreground">
                  {entry.version}
                </Link>
              </li>
            ))}
          </ul>
        </footer>
      )}
    </main>
  );
}
