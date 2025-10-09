-- Add velocity-aware signature storage
ALTER TABLE "PhotoConsent"
  ADD COLUMN "signatureVersion" TEXT,
  ADD COLUMN "signatureCapturedAt" TIMESTAMP(3),
  ADD COLUMN "signaturePayload" JSONB;
