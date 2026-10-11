-- Mehrere Vorstellungen in einer Online-Buchung
ALTER TABLE "Reservation" ADD COLUMN "groupId" TEXT;
CREATE INDEX "Reservation_groupId_idx" ON "Reservation"("groupId");

-- Zugangslinks erneut anzeigen
ALTER TABLE "BoxOfficeAccess" ADD COLUMN "tokenEnc" TEXT;
