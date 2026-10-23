-- Persönliche Darstellung und Theme-Wahl der Mitglieder
ALTER TABLE "WebsiteTheme" ADD COLUMN "memberSelectable" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User" ADD COLUMN "colorModePreference" TEXT;
ALTER TABLE "User" ADD COLUMN "themePreferenceId" TEXT;

ALTER TABLE "User" ADD CONSTRAINT "User_themePreferenceId_fkey" FOREIGN KEY ("themePreferenceId") REFERENCES "WebsiteTheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;
