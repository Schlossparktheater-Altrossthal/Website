import type { PdfTemplate } from "../types";
import { onboardingInviteTemplate } from "./onboarding-invite";

const templates = [onboardingInviteTemplate] as const;

const templateMap = new Map<string, PdfTemplate<unknown>>();
for (const template of templates) {
  templateMap.set(template.id, template as PdfTemplate<unknown>);
}

export type PdfTemplateId = (typeof templates)[number]["id"];

export function listPdfTemplates(): ReadonlyArray<PdfTemplate<unknown>> {
  return Array.from(templateMap.values());
}

export function findPdfTemplate(id: string): PdfTemplate<unknown> | undefined {
  return templateMap.get(id);
}
