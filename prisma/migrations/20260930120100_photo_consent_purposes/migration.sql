-- Strukturierte Fotoerlaubnis: Katalog der Verwendungszwecke pro Produktion, die angekreuzte
-- Auswahl der Mitglieder und eine unveränderliche Versionshistorie je Einreichung.

-- Zielgruppe eines Zwecks: nur Volljährige, nur Minderjährige oder beide.
CREATE TYPE "public"."PhotoConsentPurposeAudience" AS ENUM ('adult', 'minor', 'both');

-- Katalog der ankreuzbaren Zwecke, pro Produktion pflegbar.
CREATE TABLE "PhotoConsentPurpose" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "appliesTo" "public"."PhotoConsentPurposeAudience" NOT NULL DEFAULT 'both',
    "isRefusal" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoConsentPurpose_pkey" PRIMARY KEY ("id")
);

-- Angekreuzte bzw. nicht angekreuzte Zwecke des aktuellen Stands einer Fotoerlaubnis.
CREATE TABLE "PhotoConsentChoice" (
    "id" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "purposeId" TEXT NOT NULL,
    "chosen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PhotoConsentChoice_pkey" PRIMARY KEY ("id")
);

-- Unveränderliche Version je Einreichung (Nachweis und Auswahl).
CREATE TABLE "PhotoConsentVersion" (
    "id" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "public"."PhotoConsentStatus" NOT NULL,
    "purposesSnapshot" JSONB,
    "exclusionNote" TEXT,
    "documentName" TEXT,
    "documentMime" TEXT,
    "documentSize" INTEGER,
    "documentUploadedAt" TIMESTAMP(3),
    "documentData" BYTEA,
    "signatureVersion" TEXT,
    "signatureCapturedAt" TIMESTAMP(3),
    "signaturePayload" JSONB,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'member',

    CONSTRAINT "PhotoConsentVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhotoConsentPurpose_showId_code_key" ON "PhotoConsentPurpose"("showId", "code");
CREATE INDEX "PhotoConsentPurpose_showId_sortOrder_idx" ON "PhotoConsentPurpose"("showId", "sortOrder");
CREATE UNIQUE INDEX "PhotoConsentChoice_consentId_purposeId_key" ON "PhotoConsentChoice"("consentId", "purposeId");
CREATE INDEX "PhotoConsentChoice_consentId_idx" ON "PhotoConsentChoice"("consentId");
CREATE UNIQUE INDEX "PhotoConsentVersion_consentId_version_key" ON "PhotoConsentVersion"("consentId", "version");
CREATE INDEX "PhotoConsentVersion_consentId_idx" ON "PhotoConsentVersion"("consentId");

ALTER TABLE "PhotoConsentPurpose" ADD CONSTRAINT "PhotoConsentPurpose_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhotoConsentChoice" ADD CONSTRAINT "PhotoConsentChoice_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "PhotoConsent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhotoConsentChoice" ADD CONSTRAINT "PhotoConsentChoice_purposeId_fkey" FOREIGN KEY ("purposeId") REFERENCES "PhotoConsentPurpose"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhotoConsentVersion" ADD CONSTRAINT "PhotoConsentVersion_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "PhotoConsent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhotoConsentVersion" ADD CONSTRAINT "PhotoConsentVersion_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Bestandsdaten: „nicht einverstanden" wird der neue Zustand, danach entfällt die Checkbox-Spalte.
UPDATE "PhotoConsent" SET "status" = 'noPhotos' WHERE "consentGiven" = false;
ALTER TABLE "PhotoConsent" DROP COLUMN "consentGiven";
