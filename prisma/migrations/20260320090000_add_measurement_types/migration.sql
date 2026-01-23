-- Add additional measurement types for body measurements
ALTER TYPE "public"."MeasurementType" ADD VALUE IF NOT EXISTS 'OUTSEAM';
ALTER TYPE "public"."MeasurementType" ADD VALUE IF NOT EXISTS 'CHEST_DEPTH';
ALTER TYPE "public"."MeasurementType" ADD VALUE IF NOT EXISTS 'WAIST_LENGTH';
