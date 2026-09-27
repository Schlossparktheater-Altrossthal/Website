-- Neuer Sperrlisten-Zustand „Notfall": entsteht ausschließlich über eine Notfall-Absage in
-- „Meine Termine" und ist in der Statusauswahl der Sperrliste nicht wählbar.
--
-- Idempotent, weil der Zustand in der lokalen Entwicklungsdatenbank schon existiert: Der
-- zugehörige Migrationseintrag war am 2026-09-27 verwaist (Ordner ohne SQL) und wird neu
-- aufgenommen. Auf einer frischen Datenbank legt der Befehl den Wert regulär an.
ALTER TYPE "public"."BlockedDayKind" ADD VALUE IF NOT EXISTS 'EMERGENCY';
