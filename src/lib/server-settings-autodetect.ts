import { resolveMx, resolveSrv } from "node:dns/promises";
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
const DNS_LOOKUP_ERROR_CODES = new Set([
  "ENODATA",
  "ENOTFOUND",
  "ENOENT",
  "NOTIMP",
  "REFUSED",
  "SERVFAIL",
  "TIMEOUT",
]);

type SrvService = "_submission" | "_smtps" | "_smtp";

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

async function safeResolveSrv(record: string) {
  try {
    return await resolveSrv(record);
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error ? (error as { code?: string }).code : undefined;
    if (code && DNS_LOOKUP_ERROR_CODES.has(code)) {
      return [];
    }
    return [];
  }
}

async function safeResolveMx(domain: string) {
  try {
    return await resolveMx(domain);
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error ? (error as { code?: string }).code : undefined;
    if (code && DNS_LOOKUP_ERROR_CODES.has(code)) {
      return [];
    }
    return [];
  }
}

function normaliseDnsTarget(target: string): string {
  return target.replace(/\.$/, "");
}

function sortByPriority<T extends { priority: number; weight?: number }>(records: T[]): T[] {
  return [...records].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    const weightA = a.weight ?? 0;
    const weightB = b.weight ?? 0;
    return weightB - weightA;
  });
}

function determineSecureFromService(service: SrvService): boolean {
  if (service === "_smtps") {
    return true;
  }
  return false;
}

async function resolveSrvSuggestion(
  domainCandidates: string[],
  email: string | null,
  username: string | null | undefined,
): Promise<MailServerSuggestion | null> {
  const services: SrvService[] = ["_submission", "_smtps", "_smtp"];

  for (const domain of domainCandidates) {
    for (const service of services) {
      const records = await safeResolveSrv(`${service}._tcp.${domain}`);
      if (!records || records.length === 0) {
        continue;
      }

      const [best] = sortByPriority(records);
      if (!best) {
        continue;
      }

      const host = normaliseDnsTarget(best.name);
      if (!host) {
        continue;
      }

      const secure = determineSecureFromService(service);
      return {
        mailHost: host,
        mailPort: best.port ?? DEFAULT_PORT,
        mailSecure: secure,
        mailUsername: determineUsername(undefined, email, username ?? null),
        confidence: "high",
        provider: null,
      };
    }
  }

  return null;
}

async function resolveMxSuggestion(
  domainCandidates: string[],
  email: string | null,
  username: string | null | undefined,
): Promise<MailServerSuggestion | null> {
  for (const domain of domainCandidates) {
    const records = await safeResolveMx(domain);
    if (!records || records.length === 0) {
      continue;
    }

    const [best] = sortByPriority(records);
    if (!best || !best.exchange) {
      continue;
    }

    const host = normaliseDnsTarget(best.exchange);
    if (!host) {
      continue;
    }

    return {
      mailHost: host,
      mailPort: DEFAULT_PORT,
      mailSecure: false,
      mailUsername: determineUsername(undefined, email, username ?? null),
      confidence: "medium",
      provider: null,
    };
  }

  return null;
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

  const dnsSrvSuggestion = await resolveSrvSuggestion(domainCandidates, email, input.username ?? null);
  if (dnsSrvSuggestion) {
    return dnsSrvSuggestion;
  }

  const dnsMxSuggestion = await resolveMxSuggestion(domainCandidates, email, input.username ?? null);
  if (dnsMxSuggestion) {
    return dnsMxSuggestion;
  }

  const emailDomain = extractDomainFromEmail(email);
  const suggestionHost = host ?? (emailDomain ? `smtp.${emailDomain}` : null);

  if (!suggestionHost) {
    return null;
  }

  const confidence: MailServerSuggestion["confidence"] = host ? "medium" : emailDomain ? "low" : "low";
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

