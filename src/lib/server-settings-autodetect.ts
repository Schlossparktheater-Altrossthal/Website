import { resolveMx } from "node:dns/promises";

import { z } from "zod";

const EMAIL_SCHEMA = z.string().email();

type UsernameStrategy = "email" | "preserve";

type KnownProvider = {
  name: string;
  domains: string[];
  host: string;
  port: number;
  secure: boolean;
  usernameStrategy?: UsernameStrategy;
};

const KNOWN_PROVIDERS: KnownProvider[] = [
  {
    name: "Google Mail",
    domains: ["gmail.com", "googlemail.com"],
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    usernameStrategy: "email",
  },
  {
    name: "Microsoft 365 / Outlook",
    domains: ["outlook.com", "hotmail.com", "live.com", "office365.com", "office.com"],
    host: "smtp.office365.com",
    port: 587,
    secure: true,
    usernameStrategy: "email",
  },
  {
    name: "GMX",
    domains: ["gmx.de", "gmx.net"],
    host: "mail.gmx.net",
    port: 587,
    secure: true,
    usernameStrategy: "email",
  },
  {
    name: "WEB.DE",
    domains: ["web.de"],
    host: "smtp.web.de",
    port: 587,
    secure: true,
    usernameStrategy: "email",
  },
  {
    name: "Yahoo Mail",
    domains: ["yahoo.com", "yahoo.de", "ymail.com"],
    host: "smtp.mail.yahoo.com",
    port: 465,
    secure: true,
    usernameStrategy: "email",
  },
  {
    name: "iCloud Mail",
    domains: ["icloud.com", "me.com", "mac.com"],
    host: "smtp.mail.me.com",
    port: 587,
    secure: true,
    usernameStrategy: "email",
  },
  {
    name: "Posteo",
    domains: ["posteo.de"],
    host: "posteo.de",
    port: 465,
    secure: true,
    usernameStrategy: "email",
  },
  {
    name: "IONOS",
    domains: ["ionos.de", "ionos.com", "1und1.de", "1und1.com"],
    host: "smtp.ionos.de",
    port: 587,
    secure: true,
    usernameStrategy: "email",
  },
  {
    name: "Strato",
    domains: ["strato.de", "strato.com"],
    host: "smtp.strato.de",
    port: 465,
    secure: true,
    usernameStrategy: "email",
  },
];

const DEFAULT_PORT = 587;

function sortMxRecords(records: Awaited<ReturnType<typeof resolveMx>>): string | null {
  if (!records?.length) {
    return null;
  }

  const sorted = [...records].sort((a, b) => a.priority - b.priority);
  for (const record of sorted) {
    const host = record.exchange?.trim();
    if (host) {
      return host.toLowerCase();
    }
  }

  return null;
}

async function resolveMailHostFromDns(domainCandidates: string[]): Promise<string | null> {
  for (const candidate of domainCandidates) {
    try {
      const records = await resolveMx(candidate);
      const host = sortMxRecords(records);
      if (host) {
        return host;
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code) {
        continue;
      }

      throw error;
    }
  }

  return null;
}

export type MailServerSuggestion = {
  mailHost: string;
  mailPort: number;
  mailSecure: boolean;
  mailUsername: string | null;
  confidence: "high" | "medium" | "low";
  provider: string | null;
};

type AutoDetectInput = {
  email?: string | null;
  host?: string | null;
  username?: string | null;
};

function normaliseEmail(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = EMAIL_SCHEMA.safeParse(trimmed.toLowerCase());
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

function extractDomainFromEmail(email: string | null | undefined): string | null {
  const parsed = normaliseEmail(email);
  if (!parsed) {
    return null;
  }
  const [, domain = null] = parsed.split("@");
  return domain;
}

function normaliseHost(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  const [host] = withoutProtocol.split("/");
  if (!host) {
    return null;
  }
  return host.split(":")[0] ?? null;
}

function collectDomainCandidates(email: string | null, host: string | null): string[] {
  const candidates = new Set<string>();
  if (email) {
    const domain = extractDomainFromEmail(email);
    if (domain) {
      candidates.add(domain);
    }
  }

  if (host) {
    const normalisedHost = normaliseHost(host);
    if (normalisedHost) {
      const parts = normalisedHost.split(".");
      for (let index = 0; index < parts.length - 1; index += 1) {
        const candidate = parts.slice(index).join(".");
        if (candidate) {
          candidates.add(candidate);
        }
      }
    }
  }

  return Array.from(candidates);
}

function resolveKnownProvider(domainCandidates: string[]): KnownProvider | null {
  for (const provider of KNOWN_PROVIDERS) {
    for (const candidate of domainCandidates) {
      if (provider.domains.includes(candidate)) {
        return provider;
      }
    }
  }
  return null;
}

function determineUsername(
  strategy: UsernameStrategy | undefined,
  fallbackEmail: string | null,
  providedUsername: string | null | undefined,
): string | null {
  if (strategy === "email") {
    return fallbackEmail ?? providedUsername ?? null;
  }
  if (providedUsername && providedUsername.trim()) {
    return providedUsername.trim();
  }
  return fallbackEmail ?? null;
}

export async function autoDetectMailServerSettings(
  input: AutoDetectInput,
): Promise<MailServerSuggestion | null> {
  const email = normaliseEmail(input.email ?? null);
  const host = normaliseHost(input.host ?? null);
  const domainCandidates = collectDomainCandidates(email, host);
  const provider = resolveKnownProvider(domainCandidates);

  if (provider) {
    return {
      mailHost: provider.host,
      mailPort: provider.port,
      mailSecure: provider.secure,
      mailUsername: determineUsername(provider.usernameStrategy, email, input.username ?? null),
      confidence: "high",
      provider: provider.name,
    };
  }

  if (host) {
    return {
      mailHost: host,
      mailPort: DEFAULT_PORT,
      mailSecure: false,
      mailUsername: determineUsername(undefined, email, input.username ?? null),
      confidence: "medium",
      provider: null,
    };
  }

  const dnsHost = await resolveMailHostFromDns(domainCandidates);

  if (dnsHost) {
    return {
      mailHost: dnsHost,
      mailPort: DEFAULT_PORT,
      mailSecure: false,
      mailUsername: determineUsername(undefined, email, input.username ?? null),
      confidence: "medium",
      provider: null,
    };
  }

  const emailDomain = extractDomainFromEmail(email);
  const suggestionHost = emailDomain ? `smtp.${emailDomain}` : null;

  if (!suggestionHost) {
    return null;
  }

  const confidence: MailServerSuggestion["confidence"] = "low";
  const username = determineUsername(undefined, email, input.username ?? null);

  return {
    mailHost: suggestionHost,
    mailPort: DEFAULT_PORT,
    mailSecure: false,
    mailUsername: username,
    confidence,
    provider: null,
  };
}
