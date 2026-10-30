-- Dauer bis zur Frist für die Gantt-Ansicht (docs/Plan/zeitleiste-gantt-plan.md).
ALTER TABLE "ShowMilestone" ADD COLUMN "durationDays" INTEGER NOT NULL DEFAULT 0;
