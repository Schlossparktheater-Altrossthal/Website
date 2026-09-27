-- Verknüpft einen Sperrlisten-Eintrag mit dem Termin, der ihn ausgelöst hat. „Doch dabei" in
-- „Meine Termine" kann den Eintrag damit gezielt wieder entfernen.
--
-- Idempotent, weil Spalte, Index und Fremdschlüssel in der lokalen Entwicklungsdatenbank schon
-- existieren: Der zugehörige Migrationseintrag war am 2026-09-27 verwaist (Ordner ohne SQL) und
-- wird neu aufgenommen. Auf einer frischen Datenbank legt der Befehl alles regulär an.
ALTER TABLE "BlockedDay" ADD COLUMN IF NOT EXISTS "eventId" TEXT;

CREATE INDEX IF NOT EXISTS "BlockedDay_eventId_idx" ON "BlockedDay"("eventId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BlockedDay_eventId_fkey') THEN
    ALTER TABLE "BlockedDay"
      ADD CONSTRAINT "BlockedDay_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
