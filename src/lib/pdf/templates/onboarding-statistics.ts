import { z } from "zod";

import type { PdfTemplate } from "../types";

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function ensurePageSpace(doc: PDFKit.PDFDocument, neededHeight: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight <= bottom) {
    return;
  }
  doc.addPage();
  doc.x = doc.page.margins.left;
  doc.y = doc.page.margins.top;
}

function drawSectionHeading(doc: PDFKit.PDFDocument, title: string) {
  ensurePageSpace(doc, 32);
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827").text(title);
  doc.moveDown(0.2);
  doc.strokeColor("#e5e7eb").lineWidth(1).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(0.4);
  doc.fillColor("#111827");
}

function drawKeyValue(doc: PDFKit.PDFDocument, label: string, value: string) {
  ensurePageSpace(doc, 18);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#1f2937").text(label);
  doc.moveDown(0.1);
  doc.font("Helvetica").fontSize(11).fillColor("#374151").text(value);
  doc.moveDown(0.2);
}

function drawTable(
  doc: PDFKit.PDFDocument,
  headers: readonly string[],
  rows: readonly (readonly string[])[],
  widths: readonly number[],
) {
  if (!rows.length) {
    return;
  }

  const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startX = doc.page.margins.left;

  const normalizedWidths = widths.map((width) => (width / widths.reduce((sum, value) => sum + value, 0)) * availableWidth);

  const headerHeight = 18;
  const rowHeight = 16;
  ensurePageSpace(doc, headerHeight + rowHeight * rows.length + 12);

  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827");
  headers.forEach((header, index) => {
    const offset = normalizedWidths.slice(0, index).reduce((sum, value) => sum + value, 0);
    const align = index === headers.length - 1 ? "right" : "left";
    doc.text(header, startX + offset, doc.y, {
      width: normalizedWidths[index],
      align,
      continued: index < headers.length - 1,
    });
  });
  doc.text(" ");
  doc.moveDown(0.15);
  doc.font("Helvetica").fontSize(10).fillColor("#374151");

  rows.forEach((row) => {
    const rowY = doc.y;
    row.forEach((cell, index) => {
      const offset = normalizedWidths.slice(0, index).reduce((sum, value) => sum + value, 0);
      const align = index === row.length - 1 ? "right" : "left";
      doc.text(cell, startX + offset, rowY, {
        width: normalizedWidths[index],
        align,
        continued: index < row.length - 1,
      });
    });
    doc.text(" ");
    doc.moveDown(0.05);
  });
  doc.moveDown(0.4);
}

const distributionEntrySchema = z.object({
  label: z.string(),
  count: z.number(),
  percentage: z.number().nullable(),
});

const roleEntrySchema = z.object({
  label: z.string(),
  participants: z.number(),
  participantShare: z.number().nullable(),
  normalizedShare: z.number().nullable(),
});

const historyEntrySchema = z.object({
  label: z.string(),
  participants: z.number(),
  createdAt: z.string(),
  focusBothShare: z.number().nullable(),
});

const participantEntrySchema = z.object({
  name: z.string(),
  classLabel: z.string().nullable(),
  age: z.number().nullable(),
  focus: z.string(),
  actingRole: z.string().nullable(),
  crewRoles: z.array(z.string()),
  interests: z.array(z.string()),
  dietary: z.array(z.string()),
});

const onboardingStatisticsSchema = z.object({
  generatedAt: z.string(),
  onboarding: z.object({
    id: z.string(),
    title: z.string(),
    statusLabel: z.string(),
    timeSpan: z.string().nullable(),
    participants: z.number(),
  }),
  kpis: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      helper: z.string().nullable(),
    }),
  ),
  focusDistribution: z.array(distributionEntrySchema),
  genderDistribution: z.array(distributionEntrySchema),
  ageGroups: z.array(distributionEntrySchema),
  interests: z.array(distributionEntrySchema),
  roleCoverage: z.object({
    acting: z.number().nullable(),
    crew: z.number().nullable(),
    actingRoles: z.array(roleEntrySchema),
    crewRoles: z.array(roleEntrySchema),
  }),
  process: z.object({
    steps: z.array(
      z.object({
        label: z.string(),
        completionRate: z.number().nullable(),
        dropoutRate: z.number().nullable(),
      }),
    ),
    documents: z.object({
      uploaded: z.number(),
      pending: z.number(),
      skipped: z.number(),
    }),
  }),
  diversity: z.object({
    shannon: z.number().nullable(),
    gini: z.number().nullable(),
    normalized: z.number().nullable(),
    statusLabel: z.string(),
    explanation: z.string(),
  }),
  history: z.array(historyEntrySchema),
  photoConsentRate: z.number().nullable(),
  participants: z.array(participantEntrySchema),
  filters: z
    .object({ summary: z.string(), activeCount: z.number(), totalCount: z.number() })
    .nullable(),
});

export type OnboardingStatisticsPdfData = z.infer<typeof onboardingStatisticsSchema>;

const numberFormatter = new Intl.NumberFormat("de-DE");
const percentFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});
const dateOnlyFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

function formatPercentage(value: number | null) {
  if (value === null) {
    return "–";
  }
  return `${percentFormatter.format(value)} %`;
}

function formatNumber(value: number | null) {
  if (value === null) {
    return "–";
  }
  return numberFormatter.format(value);
}

export const onboardingStatisticsTemplate: PdfTemplate<OnboardingStatisticsPdfData> = {
  id: "onboarding-statistics",
  label: "Onboarding-Dashboard Report",
  description:
    "Verdichtet zentrale Kennzahlen des Onboarding-Dashboards auf wenigen Seiten als übersichtliches PDF.",
  filename: (data) => {
    const slug = slugify(data.onboarding.title);
    const datePart = dateOnlyFormatter.format(new Date(data.generatedAt));
    return slug ? `onboarding-statistik-${slug}.pdf` : `onboarding-statistik-${datePart}.pdf`;
  },
  schema: onboardingStatisticsSchema,
  documentOptions: {
    size: "A4",
    margins: { top: 56, left: 56, right: 56, bottom: 64 },
  },
  render(doc, data) {
    const generatedAt = new Date(data.generatedAt);
    const subtitle = data.onboarding.timeSpan
      ? `${data.onboarding.timeSpan} · ${data.onboarding.statusLabel}`
      : data.onboarding.statusLabel;

    doc.info.Title = `Onboarding-Statistik ${data.onboarding.title}`;
    doc.info.Subject = "Kennzahlen zum Onboarding";
    doc.info.Author = "Ensemble Portal";

    doc.font("Helvetica-Bold").fontSize(20).fillColor("#0f172a").text("Onboarding-Statistik", {
      align: "left",
    });
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#111827").text(data.onboarding.title);
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(11).fillColor("#4b5563").text(subtitle);
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(10).fillColor("#6b7280").text(
      `Erstellt am ${dateFormatter.format(generatedAt)} · ${formatNumber(data.onboarding.participants)} Teilnehmende`,
    );

    drawSectionHeading(doc, "Schlüsselindikatoren");
    data.kpis.forEach((kpi) => {
      const helperText = kpi.helper ? ` (${kpi.helper})` : "";
      drawKeyValue(doc, kpi.label, `${kpi.value}${helperText}`);
    });

    if (data.photoConsentRate !== null) {
      drawKeyValue(doc, "Fotoeinverständnis", formatPercentage(data.photoConsentRate));
    }

    drawSectionHeading(doc, "Fokus und Demografie");
    drawTable(
      doc,
      ["Fokus", "Personen", "Anteil"],
      data.focusDistribution.map((entry) => [
        entry.label,
        formatNumber(entry.count),
        formatPercentage(entry.percentage),
      ]),
      [2, 1, 1],
    );

    drawTable(
      doc,
      ["Geschlecht", "Personen", "Anteil"],
      data.genderDistribution.map((entry) => [
        entry.label,
        formatNumber(entry.count),
        formatPercentage(entry.percentage),
      ]),
      [2, 1, 1],
    );

    drawTable(
      doc,
      ["Altersgruppe", "Personen", "Anteil"],
      data.ageGroups.map((entry) => [
        entry.label,
        formatNumber(entry.count),
        formatPercentage(entry.percentage),
      ]),
      [2, 1, 1],
    );

    if (data.interests.length) {
      drawSectionHeading(doc, "Top-Interessen");
      drawTable(
        doc,
        ["Tag", "Nennungen", "Anteil"],
        data.interests.map((entry) => [
          entry.label,
          formatNumber(entry.count),
          formatPercentage(entry.percentage),
        ]),
        [2, 1, 1],
      );
    }

    drawSectionHeading(doc, "Besetzung");
    drawKeyValue(doc, "Abdeckung Schauspiel", formatPercentage(data.roleCoverage.acting));
    drawKeyValue(doc, "Abdeckung Crew", formatPercentage(data.roleCoverage.crew));

    if (data.roleCoverage.actingRoles.length) {
      drawTable(
        doc,
        ["Rolle Schauspiel", "Personen", "Teilnahme", "Interesse"],
        data.roleCoverage.actingRoles.map((entry) => [
          entry.label,
          formatNumber(entry.participants),
          formatPercentage(entry.participantShare),
          formatPercentage(entry.normalizedShare),
        ]),
        [3, 1, 1, 1],
      );
    }

    if (data.roleCoverage.crewRoles.length) {
      drawTable(
        doc,
        ["Rolle Crew", "Personen", "Teilnahme", "Interesse"],
        data.roleCoverage.crewRoles.map((entry) => [
          entry.label,
          formatNumber(entry.participants),
          formatPercentage(entry.participantShare),
          formatPercentage(entry.normalizedShare),
        ]),
        [3, 1, 1, 1],
      );
    }

    if (data.participants.length) {
      drawSectionHeading(doc, "Teilnehmende");
      if (data.filters) {
        drawKeyValue(
          doc,
          "Aktive Ansicht",
          `${data.filters.summary} · ${formatNumber(data.filters.activeCount)} von ${formatNumber(data.filters.totalCount)}`,
        );
      }

      drawTable(
        doc,
        ["Name", "Klasse", "Alter", "Bereich", "Gewerke / Interessen", "Ernährung"],
        data.participants.map((entry) => {
          const focusLabel =
            entry.focus === "acting"
              ? "Schauspiel"
              : entry.focus === "tech"
                ? "Technik"
                : "Act & Tech";
          const areaLabel = entry.actingRole ? `${entry.actingRole} · ${focusLabel}` : focusLabel;
          const rolesAndInterests = [...entry.crewRoles, ...entry.interests].filter(Boolean).join(", ");

          return [
            entry.name,
            entry.classLabel ?? "–",
            formatNumber(entry.age),
            areaLabel,
            rolesAndInterests || "–",
            entry.dietary.join(", ") || "–",
          ];
        }),
        [2, 1, 1, 1.4, 2, 1.6],
      );
    }

    drawSectionHeading(doc, "Prozessfortschritt");
    if (data.process.steps.length) {
      drawTable(
        doc,
        ["Schritt", "Abschluss", "Abbruch"],
        data.process.steps.map((step) => [
          step.label,
          formatPercentage(step.completionRate),
          formatPercentage(step.dropoutRate),
        ]),
        [3, 1, 1],
      );
    }

    drawKeyValue(
      doc,
      "Unterlagen",
      `${formatNumber(data.process.documents.uploaded)} hochgeladen · ${formatNumber(
        data.process.documents.pending,
      )} offen · ${formatNumber(data.process.documents.skipped)} übersprungen`,
    );

    drawSectionHeading(doc, "Diversität");
    const diversityLines = [
      `Shannon: ${data.diversity.shannon !== null ? data.diversity.shannon.toFixed(2) : "–"}`,
      `Gini: ${data.diversity.gini !== null ? data.diversity.gini.toFixed(2) : "–"}`,
      `Normalisiert: ${data.diversity.normalized !== null ? data.diversity.normalized.toFixed(2) : "–"}`,
    ];
    drawKeyValue(doc, "Status", data.diversity.statusLabel);
    drawKeyValue(doc, "Kennzahlen", diversityLines.join(" · "));
    drawKeyValue(doc, "Erläuterung", data.diversity.explanation);

    if (data.history.length) {
      drawSectionHeading(doc, "Verlauf");
      drawTable(
        doc,
        ["Zeitpunkt", "Teilnehmende", "Fokus: beide"],
        data.history.map((entry) => [
          entry.label,
          formatNumber(entry.participants),
          formatPercentage(entry.focusBothShare),
        ]),
        [2, 1, 1],
      );
    }
  },
};
