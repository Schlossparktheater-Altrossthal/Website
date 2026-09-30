-- Neuer Zustand „gar nicht" (Mitglied lehnt Aufnahmen ab) für die Fotoerlaubnis.
-- Eigene Migration, weil ein neu hinzugefügter Enum-Wert in PostgreSQL nicht in derselben
-- Transaktion verwendet werden darf (die Tabellen-Migration nutzt ihn in Bestandsdaten).
ALTER TYPE "public"."PhotoConsentStatus" ADD VALUE IF NOT EXISTS 'noPhotos';
