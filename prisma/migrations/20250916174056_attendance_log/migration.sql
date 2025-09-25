-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('member', 'cast', 'tech', 'board', 'finance_admin', 'admin');

-- CreateEnum
CREATE TYPE "public"."ClueType" AS ENUM ('text', 'image', 'audio', 'riddle');

-- CreateEnum
CREATE TYPE "public"."AttendanceStatus" AS ENUM ('yes', 'no', 'maybe');

-- CreateEnum
CREATE TYPE "public"."AvailabilityStatus" AS ENUM ('blocked', 'available');

-- CreateEnum
CREATE TYPE "public"."AvailabilityKind" AS ENUM ('FULL_AVAILABLE', 'FULL_UNAVAILABLE', 'PARTIAL');

-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('todo', 'doing', 'done');

-- CreateEnum
CREATE TYPE "public"."FinanceType" AS ENUM ('income', 'expense');

-- CreateEnum
CREATE TYPE "public"."VisibilityScope" AS ENUM ('board', 'finance_admin');

-- CreateEnum
CREATE TYPE "public"."Audience" AS ENUM ('all', 'group', 'role');

-- CreateEnum
CREATE TYPE "public"."RehearsalPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."RehearsalStatus" AS ENUM ('PLANNED', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."MeasurementUnit" AS ENUM ('mm', 'cm', 'inch');

-- CreateEnum
CREATE TYPE "public"."SizeSystem" AS ENUM ('EU', 'DE', 'US', 'UK', 'FR', 'IT', 'INT');

-- CreateEnum
CREATE TYPE "public"."SizeCategory" AS ENUM ('top', 'bottom', 'dress', 'suit', 'shirt', 'pants', 'jeans', 'bra', 'shoe', 'hat', 'glove', 'belt', 'ring', 'other');

-- CreateTable
CREATE TABLE "public"."AvailabilityDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" "public"."AvailabilityKind" NOT NULL,
    "availableFromMin" INTEGER,
    "availableToMin" INTEGER,
    "note" TEXT,

    CONSTRAINT "AvailabilityDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AvailabilityTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "kind" "public"."AvailabilityKind" NOT NULL,
    "availableFromMin" INTEGER,
    "availableToMin" INTEGER,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),

    CONSTRAINT "AvailabilityTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "role" "public"."Role" NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "public"."Clue" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "type" "public"."ClueType" NOT NULL,
    "content" JSONB NOT NULL,
    "releaseAt" TIMESTAMP(3) NOT NULL,
    "points" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Clue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Guess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "guessText" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Rehearsal" (
    "id" TEXT NOT NULL,
    "showId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Probe',
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "requiredRoles" JSONB NOT NULL,
    "isFromTemplate" BOOLEAN NOT NULL DEFAULT false,
    "templateId" TEXT,
    "priority" "public"."RehearsalPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "public"."RehearsalStatus" NOT NULL DEFAULT 'PLANNED',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rehearsal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RehearsalTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "requiredRoles" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" "public"."RehearsalPriority" NOT NULL DEFAULT 'NORMAL',
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RehearsalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RehearsalAttendance" (
    "id" TEXT NOT NULL,
    "rehearsalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."AttendanceStatus" NOT NULL,

    CONSTRAINT "RehearsalAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RehearsalAttendanceLog" (
    "id" TEXT NOT NULL,
    "rehearsalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previous" "public"."AttendanceStatus",
    "next" "public"."AttendanceStatus",
    "comment" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT NOT NULL,

    CONSTRAINT "RehearsalAttendanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Availability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "status" "public"."AvailabilityStatus" NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT,
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'todo',
    "labels" JSONB NOT NULL,
    "dueAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InventoryItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "location" TEXT,
    "owner" TEXT,
    "condition" TEXT,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceEntry" (
    "id" TEXT NOT NULL,
    "type" "public"."FinanceType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" TEXT,
    "showId" TEXT,
    "visibilityScope" "public"."VisibilityScope" NOT NULL,

    CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Announcement" (
    "id" TEXT NOT NULL,
    "audience" "public"."Audience" NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberMeasurement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" "public"."MeasurementUnit" NOT NULL DEFAULT 'cm',
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "takenBy" TEXT,
    "note" TEXT,

    CONSTRAINT "MemberMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberSize" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "public"."SizeCategory" NOT NULL,
    "system" "public"."SizeSystem" NOT NULL DEFAULT 'EU',
    "value" TEXT NOT NULL,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberSize_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityDay_userId_date_key" ON "public"."AvailabilityDay"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Clue_showId_published_releaseAt_idx" ON "public"."Clue"("showId", "published", "releaseAt");

-- CreateIndex
CREATE UNIQUE INDEX "Clue_showId_index_key" ON "public"."Clue"("showId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "RehearsalAttendance_rehearsalId_userId_key" ON "public"."RehearsalAttendance"("rehearsalId", "userId");

-- CreateIndex
CREATE INDEX "RehearsalAttendanceLog_rehearsalId_changedAt_idx" ON "public"."RehearsalAttendanceLog"("rehearsalId", "changedAt");

-- CreateIndex
CREATE INDEX "MemberMeasurement_userId_key_takenAt_idx" ON "public"."MemberMeasurement"("userId", "key", "takenAt");

-- CreateIndex
CREATE INDEX "MemberSize_userId_category_system_idx" ON "public"."MemberSize"("userId", "category", "system");

-- AddForeignKey
ALTER TABLE "public"."AvailabilityDay" ADD CONSTRAINT "AvailabilityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AvailabilityTemplate" ADD CONSTRAINT "AvailabilityTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Clue" ADD CONSTRAINT "Clue_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Guess" ADD CONSTRAINT "Guess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Guess" ADD CONSTRAINT "Guess_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Rehearsal" ADD CONSTRAINT "Rehearsal_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Rehearsal" ADD CONSTRAINT "Rehearsal_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."RehearsalTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RehearsalAttendance" ADD CONSTRAINT "RehearsalAttendance_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "public"."Rehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RehearsalAttendance" ADD CONSTRAINT "RehearsalAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RehearsalAttendanceLog" ADD CONSTRAINT "RehearsalAttendanceLog_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "public"."Rehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RehearsalAttendanceLog" ADD CONSTRAINT "RehearsalAttendanceLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RehearsalAttendanceLog" ADD CONSTRAINT "RehearsalAttendanceLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Availability" ADD CONSTRAINT "Availability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinanceEntry" ADD CONSTRAINT "FinanceEntry_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberMeasurement" ADD CONSTRAINT "MemberMeasurement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberSize" ADD CONSTRAINT "MemberSize_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
