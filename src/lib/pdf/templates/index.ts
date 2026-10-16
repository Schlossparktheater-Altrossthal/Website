import type { PdfTemplate } from "../types";
import { dataPortalTableTemplate } from "./data-portal-table";
import { doorChecklistTemplate } from "./door-checklist";
import { koerpermasseTemplate } from "./koerpermasse";
import { onboardingInviteTemplate } from "./onboarding-invite";
import { onboardingStatisticsTemplate } from "./onboarding-statistics";
import { photoConsentListTemplate } from "./photo-consent-list";
import { productionCastingTemplate } from "./production-casting";
import { requisitenAblaufTemplate } from "./requisiten-ablauf";
import { sperrlisteImportantDaysTemplate } from "./sperrliste-wichtige-tage";
import { terminlisteTemplate } from "./terminliste";
import { wunschlisteTemplate } from "./wunschliste";
import { scriptReaderPdfTemplate } from "@/lib/skript/pdf";

const templates = [
  dataPortalTableTemplate,
  doorChecklistTemplate,
  koerpermasseTemplate,
  onboardingInviteTemplate,
  onboardingStatisticsTemplate,
  photoConsentListTemplate,
  productionCastingTemplate,
  requisitenAblaufTemplate,
  sperrlisteImportantDaysTemplate,
  terminlisteTemplate,
  wunschlisteTemplate,
  scriptReaderPdfTemplate,
] as const;

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
