-- Reine Einlass-Zugänge ohne Kartenbüro (docs/Plan/kartenbuchung-plan.md)
ALTER TABLE "BoxOfficeAccess" ADD COLUMN "canOffice" BOOLEAN NOT NULL DEFAULT true;
