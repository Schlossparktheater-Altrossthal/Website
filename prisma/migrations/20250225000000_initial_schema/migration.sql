-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('member', 'cast', 'tech', 'board', 'finance', 'owner', 'admin');

-- CreateEnum
CREATE TYPE "public"."SyncScope" AS ENUM ('inventory', 'tickets');

-- CreateEnum
CREATE TYPE "public"."TicketStatus" AS ENUM ('unused', 'checked_in', 'invalid');

-- CreateEnum
CREATE TYPE "public"."DepartmentMembershipRole" AS ENUM ('lead', 'member', 'deputy', 'guest');

-- CreateEnum
CREATE TYPE "public"."CharacterCastingType" AS ENUM ('primary', 'alternate', 'cover', 'cameo');

-- CreateEnum
CREATE TYPE "public"."BreakdownStatus" AS ENUM ('planned', 'in_progress', 'blocked', 'ready', 'done');

-- CreateEnum
CREATE TYPE "public"."AvatarSource" AS ENUM ('GRAVATAR', 'UPLOAD', 'INITIALS');

-- CreateEnum
CREATE TYPE "public"."ClueType" AS ENUM ('text', 'image', 'audio', 'riddle');

-- CreateEnum
CREATE TYPE "public"."AttendanceStatus" AS ENUM ('yes', 'no', 'emergency', 'maybe');

-- CreateEnum
CREATE TYPE "public"."GalleryMediaType" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "public"."AvailabilityStatus" AS ENUM ('blocked', 'available');

-- CreateEnum
CREATE TYPE "public"."OnboardingFocus" AS ENUM ('acting', 'tech', 'both');

-- CreateEnum
CREATE TYPE "public"."RolePreferenceDomain" AS ENUM ('acting', 'crew');

-- CreateEnum
CREATE TYPE "public"."RehearsalProposalStatus" AS ENUM ('proposed', 'approved', 'rejected', 'scheduled');

-- CreateEnum
CREATE TYPE "public"."AvailabilityKind" AS ENUM ('FULL_AVAILABLE', 'FULL_UNAVAILABLE', 'PARTIAL');

-- CreateEnum
CREATE TYPE "public"."BlockedDayKind" AS ENUM ('BLOCKED', 'PREFERRED');

-- CreateEnum
CREATE TYPE "public"."MeasurementUnit" AS ENUM ('CM', 'INCH', 'EU', 'DE');

-- CreateEnum
CREATE TYPE "public"."MeasurementType" AS ENUM ('HEIGHT', 'CHEST', 'WAIST', 'HIPS', 'INSEAM', 'SHOULDER', 'SLEEVE', 'SHOE_SIZE', 'HEAD');

-- CreateEnum
CREATE TYPE "public"."AllergyLevel" AS ENUM ('MILD', 'MODERATE', 'SEVERE', 'LETHAL');

-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('todo', 'doing', 'done');

-- CreateEnum
CREATE TYPE "public"."FinanceType" AS ENUM ('income', 'expense');

-- CreateEnum
CREATE TYPE "public"."FinanceEntryKind" AS ENUM ('general', 'invoice', 'donation');

-- CreateEnum
CREATE TYPE "public"."FinanceEntryStatus" AS ENUM ('draft', 'pending', 'approved', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."VisibilityScope" AS ENUM ('board', 'finance');

-- CreateEnum
CREATE TYPE "public"."Audience" AS ENUM ('all', 'group', 'role');

-- CreateEnum
CREATE TYPE "public"."IssueCategory" AS ENUM ('general', 'website_bug', 'improvement', 'support', 'other');

-- CreateEnum
CREATE TYPE "public"."IssueStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "public"."IssuePriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "public"."IssueVisibility" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "public"."RehearsalPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."RehearsalStatus" AS ENUM ('DRAFT', 'PLANNED', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."PhotoConsentStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "public"."AnalyticsRequestArea" AS ENUM ('public', 'members', 'api', 'unknown');

-- CreateEnum
CREATE TYPE "public"."AnalyticsServerLogSeverity" AS ENUM ('info', 'warning', 'error');

-- CreateEnum
CREATE TYPE "public"."AnalyticsServerLogStatus" AS ENUM ('open', 'monitoring', 'resolved');

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
    "firstName" TEXT,
    "lastName" TEXT,
    "name" TEXT,
    "email" TEXT,
    "role" "public"."Role" NOT NULL DEFAULT 'member',
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateOfBirth" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "avatarSource" "public"."AvatarSource" NOT NULL DEFAULT 'GRAVATAR',
    "avatarImage" BYTEA,
    "avatarImageMime" TEXT,
    "avatarImageUpdatedAt" TIMESTAMP(3),

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

-- CreateTable
CREATE TABLE "public"."OwnerSetupToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "OwnerSetupToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Show" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "title" TEXT,
    "synopsis" TEXT,
    "dates" JSONB NOT NULL,
    "posterUrl" TEXT,
    "revealedAt" TIMESTAMP(3),
    "finalRehearsalWeekStart" TIMESTAMP(3),
    "meta" JSONB,

    CONSTRAINT "Show_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinalRehearsalDuty" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startTime" INTEGER,
    "endTime" INTEGER,
    "assigneeId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalRehearsalDuty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Department" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "isCore" BOOLEAN NOT NULL DEFAULT true,
    "requiresJoinApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DepartmentMembership" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."DepartmentMembershipRole" NOT NULL DEFAULT 'member',
    "title" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DepartmentTask" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'todo',
    "dueAt" TIMESTAMP(3),
    "assigneeId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DepartmentPermission" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "DepartmentPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Character" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CharacterCasting" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."CharacterCastingType" NOT NULL DEFAULT 'primary',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterCasting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Scene" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "identifier" TEXT,
    "title" TEXT,
    "slug" TEXT,
    "summary" TEXT,
    "location" TEXT,
    "timeOfDay" TEXT,
    "durationMinutes" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SceneCharacter" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SceneCharacter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SceneBreakdownItem" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."BreakdownStatus" NOT NULL DEFAULT 'planned',
    "neededBy" TIMESTAMP(3),
    "note" TEXT,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SceneBreakdownItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
CREATE TABLE "public"."HomepageCountdown" (
    "id" TEXT NOT NULL DEFAULT 'public',
    "countdownTarget" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageCountdown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MysterySettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "countdownTarget" TIMESTAMP(3),
    "expirationMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MysterySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebsiteTheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tokens" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebsiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'public',
    "siteTitle" TEXT NOT NULL DEFAULT 'Sommertheater im Schlosspark',
    "colorMode" TEXT NOT NULL DEFAULT 'dark',
    "themeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SperrlisteSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "holidaySourceMode" TEXT NOT NULL DEFAULT 'default',
    "holidaySourceUrl" TEXT,
    "holidaySourceStatus" TEXT NOT NULL DEFAULT 'unknown',
    "holidaySourceMessage" TEXT,
    "holidaySourceCheckedAt" TIMESTAMP(3),
    "freezeDays" INTEGER NOT NULL DEFAULT 7,
    "preferredWeekdays" JSONB,
    "exceptionWeekdays" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SperrlisteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MysteryTip" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MysteryTip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MysteryTipSubmission" (
    "id" TEXT NOT NULL,
    "tipId" TEXT NOT NULL,
    "clueId" TEXT,
    "playerName" TEXT NOT NULL,
    "tipText" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MysteryTipSubmission_pkey" PRIMARY KEY ("id")
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
    "registrationDeadline" TIMESTAMP(3),
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
CREATE TABLE "public"."RehearsalInvitee" (
    "id" TEXT NOT NULL,
    "rehearsalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "RehearsalInvitee_pkey" PRIMARY KEY ("id")
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
    "emergencyReason" TEXT,

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
CREATE TABLE "public"."UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AppRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "systemRole" "public"."Role",
    "sortIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AppRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AppRolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "AppRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserAppRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserAppRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberMeasurement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."MeasurementType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" "public"."MeasurementUnit" NOT NULL,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberSize" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DietaryRestriction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "allergen" TEXT NOT NULL,
    "level" "public"."AllergyLevel" NOT NULL,
    "symptoms" TEXT,
    "treatment" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DietaryRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RehearsalProposal" (
    "id" TEXT NOT NULL,
    "showId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Probenvorschlag',
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" INTEGER NOT NULL,
    "endTime" INTEGER NOT NULL,
    "location" TEXT,
    "requiredRoles" JSONB NOT NULL,
    "status" "public"."RehearsalProposalStatus" NOT NULL DEFAULT 'proposed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectionReason" TEXT,
    "rehearsalId" TEXT,

    CONSTRAINT "RehearsalProposal_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "public"."BlockedDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "kind" "public"."BlockedDayKind" NOT NULL DEFAULT 'BLOCKED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockedDay_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "public"."SyncEvent" (
    "id" TEXT NOT NULL,
    "scope" "public"."SyncScope" NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientMutationId" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "serverSeq" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SyncMutation" (
    "clientMutationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scope" "public"."SyncScope" NOT NULL,
    "eventCount" INTEGER NOT NULL,
    "firstServerSeq" INTEGER,
    "lastServerSeq" INTEGER,
    "acknowledgedSeq" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncMutation_pkey" PRIMARY KEY ("clientMutationId")
);

-- CreateTable
CREATE TABLE "public"."FinanceEntry" (
    "id" TEXT NOT NULL,
    "type" "public"."FinanceType" NOT NULL,
    "kind" "public"."FinanceEntryKind" NOT NULL DEFAULT 'general',
    "status" "public"."FinanceEntryStatus" NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "category" TEXT,
    "bookingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "invoiceNumber" TEXT,
    "vendor" TEXT,
    "memberPaidById" TEXT,
    "donationSource" TEXT,
    "donorContact" TEXT,
    "tags" JSONB,
    "showId" TEXT,
    "budgetId" TEXT,
    "visibilityScope" "public"."VisibilityScope" NOT NULL DEFAULT 'finance',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceAttachment" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceBudget" (
    "id" TEXT NOT NULL,
    "showId" TEXT,
    "category" TEXT NOT NULL,
    "plannedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceLog" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "changedById" TEXT,
    "fromStatus" "public"."FinanceEntryStatus",
    "toStatus" "public"."FinanceEntryStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rehearsalId" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationRecipient" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Issue" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "public"."IssueCategory" NOT NULL DEFAULT 'general',
    "status" "public"."IssueStatus" NOT NULL DEFAULT 'open',
    "priority" "public"."IssuePriority" NOT NULL DEFAULT 'medium',
    "visibility" "public"."IssueVisibility" NOT NULL DEFAULT 'public',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IssueComment" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssueComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PhotoConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."PhotoConsentStatus" NOT NULL DEFAULT 'pending',
    "consentGiven" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectionReason" TEXT,
    "documentName" TEXT,
    "documentMime" TEXT,
    "documentSize" INTEGER,
    "documentUploadedAt" TIMESTAMP(3),
    "documentData" BYTEA,

    CONSTRAINT "PhotoConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GalleryItem" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mediaType" "public"."GalleryMediaType" NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "uploadedById" TEXT NOT NULL,

    CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberInvite" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "roles" "public"."Role"[],
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "showId" TEXT NOT NULL,

    CONSTRAINT "MemberInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberInviteRedemption" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "email" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "payload" JSONB,

    CONSTRAINT "MemberInviteRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Interest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "Interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "interestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberRolePreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "domain" "public"."RolePreferenceDomain" NOT NULL,
    "weight" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberRolePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberOnboardingProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inviteId" TEXT,
    "redemptionId" TEXT,
    "showId" TEXT,
    "focus" "public"."OnboardingFocus" NOT NULL,
    "background" TEXT,
    "backgroundClass" TEXT,
    "notes" TEXT,
    "gender" TEXT,
    "memberSinceYear" INTEGER,
    "dietaryPreference" TEXT,
    "dietaryPreferenceStrictness" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberOnboardingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductionMembership" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "ProductionMembership_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "public"."AnalyticsHttpRequest" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "route" TEXT NOT NULL,
    "area" "public"."AnalyticsRequestArea" NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "payloadBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsHttpRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnalyticsUptimeHeartbeat" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL DEFAULT 'app-server',
    "isHealthy" BOOLEAN NOT NULL DEFAULT true,
    "latencyMs" INTEGER,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsUptimeHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_http_summary" (
    "id" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "successfulRequests" INTEGER NOT NULL DEFAULT 0,
    "clientErrorRequests" INTEGER NOT NULL DEFAULT 0,
    "serverErrorRequests" INTEGER NOT NULL DEFAULT 0,
    "averageDurationMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "p95DurationMs" INTEGER,
    "averagePayloadBytes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uptimePercentage" DOUBLE PRECISION,
    "frontendRequests" INTEGER NOT NULL DEFAULT 0,
    "frontendAvgResponseMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "frontendAvgPayloadBytes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "membersRequests" INTEGER NOT NULL DEFAULT 0,
    "membersAvgResponseMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "apiRequests" INTEGER NOT NULL DEFAULT 0,
    "apiAvgResponseMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "apiErrorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_http_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_http_peak_hours" (
    "id" TEXT NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "bucketEnd" TIMESTAMP(3) NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "share" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_http_peak_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnalyticsPageView" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "path" TEXT NOT NULL,
    "scope" TEXT,
    "userAgent" TEXT,
    "deviceHint" TEXT,
    "lcpMs" DOUBLE PRECISION,
    "loadTimeMs" DOUBLE PRECISION,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analyticsSessionId" TEXT,

    CONSTRAINT "AnalyticsPageView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnalyticsDeviceSnapshot" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "deviceHint" TEXT,
    "userAgent" TEXT,
    "platform" TEXT,
    "hardwareConcurrency" INTEGER,
    "deviceMemoryGb" DOUBLE PRECISION,
    "touchSupport" INTEGER,
    "reducedMotion" BOOLEAN,
    "prefersDarkMode" BOOLEAN,
    "colorScheme" TEXT,
    "connectionType" TEXT,
    "connectionEffectiveType" TEXT,
    "connectionRttMs" DOUBLE PRECISION,
    "connectionDownlinkMbps" DOUBLE PRECISION,
    "viewportWidth" INTEGER,
    "viewportHeight" INTEGER,
    "pixelRatio" DOUBLE PRECISION,
    "language" TEXT,
    "timezone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsDeviceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_page_metrics" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "scope" TEXT,
    "avg_load" DOUBLE PRECISION NOT NULL,
    "lcp" DOUBLE PRECISION,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_page_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_device_metrics" (
    "id" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "sessions" INTEGER NOT NULL,
    "avg_load" DOUBLE PRECISION NOT NULL,
    "share" DOUBLE PRECISION NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_device_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnalyticsSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "membershipRole" TEXT,
    "isMember" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "pagePaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnalyticsTrafficAttribution" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "analyticsSessionId" TEXT,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "referrerDomain" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsTrafficAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnalyticsRealtimeEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsRealtimeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_session_insights" (
    "id" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "avgSessionDurationSeconds" DOUBLE PRECISION NOT NULL,
    "pagesPerSession" DOUBLE PRECISION NOT NULL,
    "retentionRate" DOUBLE PRECISION NOT NULL,
    "share" DOUBLE PRECISION NOT NULL,
    "conversionRate" DOUBLE PRECISION NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_session_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_traffic_sources" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "sessions" INTEGER NOT NULL,
    "avgSessionDurationSeconds" DOUBLE PRECISION NOT NULL,
    "conversionRate" DOUBLE PRECISION NOT NULL,
    "changePercent" DOUBLE PRECISION NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_traffic_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Ticket" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "holderName" TEXT,
    "status" "public"."TicketStatus" NOT NULL DEFAULT 'unused',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TicketScanEvent" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "statusBefore" "public"."TicketStatus" NOT NULL,
    "statusAfter" "public"."TicketStatus" NOT NULL,
    "source" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "dedupeKey" TEXT,
    "serverSeq" INTEGER,
    "processedAt" TIMESTAMP(3),
    "provisional" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT,
    "clientMutationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketScanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_realtime_summary" (
    "id" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "totalEvents" INTEGER NOT NULL,
    "eventCounts" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_realtime_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_server_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "severity" "public"."AnalyticsServerLogSeverity" NOT NULL,
    "service" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "public"."AnalyticsServerLogStatus" NOT NULL DEFAULT 'open',
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "affectedUsers" INTEGER,
    "recommendedAction" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fingerprint" TEXT NOT NULL,

    CONSTRAINT "analytics_server_logs_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "OwnerSetupToken_tokenHash_key" ON "public"."OwnerSetupToken"("tokenHash");

-- CreateIndex
CREATE INDEX "FinalRehearsalDuty_showId_date_idx" ON "public"."FinalRehearsalDuty"("showId", "date");

-- CreateIndex
CREATE INDEX "FinalRehearsalDuty_assigneeId_idx" ON "public"."FinalRehearsalDuty"("assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_slug_key" ON "public"."Department"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentMembership_departmentId_userId_key" ON "public"."DepartmentMembership"("departmentId", "userId");

-- CreateIndex
CREATE INDEX "DepartmentTask_departmentId_status_idx" ON "public"."DepartmentTask"("departmentId", "status");

-- CreateIndex
CREATE INDEX "DepartmentTask_assigneeId_idx" ON "public"."DepartmentTask"("assigneeId");

-- CreateIndex
CREATE INDEX "DepartmentTask_createdAt_idx" ON "public"."DepartmentTask"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentPermission_departmentId_permissionId_key" ON "public"."DepartmentPermission"("departmentId", "permissionId");

-- CreateIndex
CREATE INDEX "Character_showId_order_idx" ON "public"."Character"("showId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterCasting_characterId_userId_type_key" ON "public"."CharacterCasting"("characterId", "userId", "type");

-- CreateIndex
CREATE INDEX "Scene_showId_sequence_idx" ON "public"."Scene"("showId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Scene_showId_slug_key" ON "public"."Scene"("showId", "slug");

-- CreateIndex
CREATE INDEX "SceneCharacter_characterId_idx" ON "public"."SceneCharacter"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "SceneCharacter_sceneId_characterId_key" ON "public"."SceneCharacter"("sceneId", "characterId");

-- CreateIndex
CREATE INDEX "SceneBreakdownItem_sceneId_departmentId_idx" ON "public"."SceneBreakdownItem"("sceneId", "departmentId");

-- CreateIndex
CREATE INDEX "Clue_showId_published_releaseAt_idx" ON "public"."Clue"("showId", "published", "releaseAt");

-- CreateIndex
CREATE UNIQUE INDEX "Clue_showId_index_key" ON "public"."Clue"("showId", "index");

-- CreateIndex
CREATE INDEX "WebsiteSettings_themeId_idx" ON "public"."WebsiteSettings"("themeId");

-- CreateIndex
CREATE UNIQUE INDEX "MysteryTip_normalizedText_key" ON "public"."MysteryTip"("normalizedText");

-- CreateIndex
CREATE INDEX "MysteryTipSubmission_clueId_idx" ON "public"."MysteryTipSubmission"("clueId");

-- CreateIndex
CREATE INDEX "MysteryTipSubmission_playerName_idx" ON "public"."MysteryTipSubmission"("playerName");

-- CreateIndex
CREATE INDEX "MysteryTipSubmission_tipId_idx" ON "public"."MysteryTipSubmission"("tipId");

-- CreateIndex
CREATE UNIQUE INDEX "RehearsalInvitee_rehearsalId_userId_key" ON "public"."RehearsalInvitee"("rehearsalId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RehearsalAttendance_rehearsalId_userId_key" ON "public"."RehearsalAttendance"("rehearsalId", "userId");

-- CreateIndex
CREATE INDEX "RehearsalAttendanceLog_rehearsalId_changedAt_idx" ON "public"."RehearsalAttendanceLog"("rehearsalId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "public"."UserRole"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "public"."Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AppRole_name_key" ON "public"."AppRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AppRolePermission_roleId_permissionId_key" ON "public"."AppRolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAppRole_userId_roleId_key" ON "public"."UserAppRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberMeasurement_userId_type_key" ON "public"."MemberMeasurement"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "MemberSize_userId_category_key" ON "public"."MemberSize"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "DietaryRestriction_userId_allergen_key" ON "public"."DietaryRestriction"("userId", "allergen");

-- CreateIndex
CREATE INDEX "RehearsalProposal_date_status_idx" ON "public"."RehearsalProposal"("date", "status");

-- CreateIndex
CREATE INDEX "RehearsalProposal_showId_status_idx" ON "public"."RehearsalProposal"("showId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedDay_userId_date_key" ON "public"."BlockedDay"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SyncEvent_serverSeq_key" ON "public"."SyncEvent"("serverSeq");

-- CreateIndex
CREATE INDEX "SyncEvent_scope_serverSeq_idx" ON "public"."SyncEvent"("scope", "serverSeq");

-- CreateIndex
CREATE INDEX "SyncEvent_scope_dedupeKey_idx" ON "public"."SyncEvent"("scope", "dedupeKey");

-- CreateIndex
CREATE INDEX "SyncEvent_scope_occurredAt_idx" ON "public"."SyncEvent"("scope", "occurredAt");

-- CreateIndex
CREATE INDEX "SyncMutation_scope_clientId_idx" ON "public"."SyncMutation"("scope", "clientId");

-- CreateIndex
CREATE INDEX "FinanceEntry_showId_status_idx" ON "public"."FinanceEntry"("showId", "status");

-- CreateIndex
CREATE INDEX "FinanceEntry_budgetId_idx" ON "public"."FinanceEntry"("budgetId");

-- CreateIndex
CREATE INDEX "FinanceEntry_memberPaidById_bookingDate_idx" ON "public"."FinanceEntry"("memberPaidById", "bookingDate");

-- CreateIndex
CREATE INDEX "FinanceAttachment_entryId_idx" ON "public"."FinanceAttachment"("entryId");

-- CreateIndex
CREATE INDEX "FinanceBudget_showId_category_idx" ON "public"."FinanceBudget"("showId", "category");

-- CreateIndex
CREATE INDEX "FinanceLog_entryId_idx" ON "public"."FinanceLog"("entryId");

-- CreateIndex
CREATE INDEX "FinanceLog_changedById_idx" ON "public"."FinanceLog"("changedById");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRecipient_notificationId_userId_key" ON "public"."NotificationRecipient"("notificationId", "userId");

-- CreateIndex
CREATE INDEX "Issue_status_lastActivityAt_idx" ON "public"."Issue"("status", "lastActivityAt");

-- CreateIndex
CREATE INDEX "Issue_category_idx" ON "public"."Issue"("category");

-- CreateIndex
CREATE INDEX "Issue_createdById_idx" ON "public"."Issue"("createdById");

-- CreateIndex
CREATE INDEX "Issue_visibility_idx" ON "public"."Issue"("visibility");

-- CreateIndex
CREATE INDEX "IssueComment_issueId_idx" ON "public"."IssueComment"("issueId");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoConsent_userId_key" ON "public"."PhotoConsent"("userId");

-- CreateIndex
CREATE INDEX "GalleryItem_year_createdAt_idx" ON "public"."GalleryItem"("year", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MemberInvite_tokenHash_key" ON "public"."MemberInvite"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "MemberInviteRedemption_sessionToken_key" ON "public"."MemberInviteRedemption"("sessionToken");

-- CreateIndex
CREATE INDEX "MemberInviteRedemption_inviteId_idx" ON "public"."MemberInviteRedemption"("inviteId");

-- CreateIndex
CREATE UNIQUE INDEX "Interest_name_key" ON "public"."Interest"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserInterest_userId_interestId_key" ON "public"."UserInterest"("userId", "interestId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberRolePreference_userId_code_key" ON "public"."MemberRolePreference"("userId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "MemberOnboardingProfile_userId_key" ON "public"."MemberOnboardingProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberOnboardingProfile_redemptionId_key" ON "public"."MemberOnboardingProfile"("redemptionId");

-- CreateIndex
CREATE INDEX "MemberOnboardingProfile_inviteId_idx" ON "public"."MemberOnboardingProfile"("inviteId");

-- CreateIndex
CREATE INDEX "ProductionMembership_userId_leftAt_idx" ON "public"."ProductionMembership"("userId", "leftAt");

-- CreateIndex
CREATE INDEX "ProductionMembership_showId_leftAt_idx" ON "public"."ProductionMembership"("showId", "leftAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionMembership_showId_userId_key" ON "public"."ProductionMembership"("showId", "userId");

-- CreateIndex
CREATE INDEX "AnalyticsHttpRequest_timestamp_idx" ON "public"."AnalyticsHttpRequest"("timestamp");

-- CreateIndex
CREATE INDEX "AnalyticsHttpRequest_area_timestamp_idx" ON "public"."AnalyticsHttpRequest"("area", "timestamp");

-- CreateIndex
CREATE INDEX "AnalyticsHttpRequest_route_idx" ON "public"."AnalyticsHttpRequest"("route");

-- CreateIndex
CREATE INDEX "AnalyticsUptimeHeartbeat_service_observedAt_idx" ON "public"."AnalyticsUptimeHeartbeat"("service", "observedAt");

-- CreateIndex
CREATE INDEX "AnalyticsUptimeHeartbeat_observedAt_idx" ON "public"."AnalyticsUptimeHeartbeat"("observedAt");

-- CreateIndex
CREATE INDEX "analytics_http_summary_windowEnd_idx" ON "public"."analytics_http_summary"("windowEnd");

-- CreateIndex
CREATE INDEX "analytics_http_peak_hours_bucketStart_idx" ON "public"."analytics_http_peak_hours"("bucketStart");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsPageView_sessionId_key" ON "public"."AnalyticsPageView"("sessionId");

-- CreateIndex
CREATE INDEX "AnalyticsPageView_path_idx" ON "public"."AnalyticsPageView"("path");

-- CreateIndex
CREATE INDEX "AnalyticsPageView_scope_idx" ON "public"."AnalyticsPageView"("scope");

-- CreateIndex
CREATE INDEX "AnalyticsPageView_deviceHint_idx" ON "public"."AnalyticsPageView"("deviceHint");

-- CreateIndex
CREATE INDEX "AnalyticsPageView_createdAt_idx" ON "public"."AnalyticsPageView"("createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsPageView_analyticsSessionId_idx" ON "public"."AnalyticsPageView"("analyticsSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsDeviceSnapshot_sessionId_key" ON "public"."AnalyticsDeviceSnapshot"("sessionId");

-- CreateIndex
CREATE INDEX "AnalyticsDeviceSnapshot_deviceHint_idx" ON "public"."AnalyticsDeviceSnapshot"("deviceHint");

-- CreateIndex
CREATE INDEX "AnalyticsDeviceSnapshot_createdAt_idx" ON "public"."AnalyticsDeviceSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "analytics_page_metrics_path_idx" ON "public"."analytics_page_metrics"("path");

-- CreateIndex
CREATE INDEX "analytics_page_metrics_scope_idx" ON "public"."analytics_page_metrics"("scope");

-- CreateIndex
CREATE INDEX "analytics_device_metrics_device_idx" ON "public"."analytics_device_metrics"("device");

-- CreateIndex
CREATE INDEX "AnalyticsSession_userId_idx" ON "public"."AnalyticsSession"("userId");

-- CreateIndex
CREATE INDEX "AnalyticsSession_lastSeenAt_idx" ON "public"."AnalyticsSession"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsTrafficAttribution_sessionId_key" ON "public"."AnalyticsTrafficAttribution"("sessionId");

-- CreateIndex
CREATE INDEX "AnalyticsTrafficAttribution_analyticsSessionId_idx" ON "public"."AnalyticsTrafficAttribution"("analyticsSessionId");

-- CreateIndex
CREATE INDEX "AnalyticsTrafficAttribution_path_idx" ON "public"."AnalyticsTrafficAttribution"("path");

-- CreateIndex
CREATE INDEX "AnalyticsTrafficAttribution_referrerDomain_idx" ON "public"."AnalyticsTrafficAttribution"("referrerDomain");

-- CreateIndex
CREATE INDEX "AnalyticsTrafficAttribution_utmSource_idx" ON "public"."AnalyticsTrafficAttribution"("utmSource");

-- CreateIndex
CREATE INDEX "AnalyticsTrafficAttribution_utmMedium_idx" ON "public"."AnalyticsTrafficAttribution"("utmMedium");

-- CreateIndex
CREATE INDEX "AnalyticsRealtimeEvent_occurredAt_idx" ON "public"."AnalyticsRealtimeEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsRealtimeEvent_eventType_occurredAt_idx" ON "public"."AnalyticsRealtimeEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_session_insights_segment_idx" ON "public"."analytics_session_insights"("segment");

-- CreateIndex
CREATE INDEX "analytics_traffic_sources_channel_idx" ON "public"."analytics_traffic_sources"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_code_key" ON "public"."Ticket"("code");

-- CreateIndex
CREATE INDEX "Ticket_eventId_idx" ON "public"."Ticket"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketScanEvent_dedupeKey_key" ON "public"."TicketScanEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "TicketScanEvent_ticketId_occurredAt_idx" ON "public"."TicketScanEvent"("ticketId", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_realtime_summary_windowEnd_idx" ON "public"."analytics_realtime_summary"("windowEnd");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_server_logs_fingerprint_key" ON "public"."analytics_server_logs"("fingerprint");

-- CreateIndex
CREATE INDEX "analytics_server_logs_severity_lastSeenAt_idx" ON "public"."analytics_server_logs"("severity", "lastSeenAt");

-- CreateIndex
CREATE INDEX "analytics_server_logs_status_lastSeenAt_idx" ON "public"."analytics_server_logs"("status", "lastSeenAt");

-- AddForeignKey
ALTER TABLE "public"."AvailabilityDay" ADD CONSTRAINT "AvailabilityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AvailabilityTemplate" ADD CONSTRAINT "AvailabilityTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinalRehearsalDuty" ADD CONSTRAINT "FinalRehearsalDuty_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinalRehearsalDuty" ADD CONSTRAINT "FinalRehearsalDuty_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinalRehearsalDuty" ADD CONSTRAINT "FinalRehearsalDuty_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepartmentTask" ADD CONSTRAINT "DepartmentTask_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepartmentTask" ADD CONSTRAINT "DepartmentTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepartmentTask" ADD CONSTRAINT "DepartmentTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepartmentPermission" ADD CONSTRAINT "DepartmentPermission_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepartmentPermission" ADD CONSTRAINT "DepartmentPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "public"."Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Character" ADD CONSTRAINT "Character_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CharacterCasting" ADD CONSTRAINT "CharacterCasting_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "public"."Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CharacterCasting" ADD CONSTRAINT "CharacterCasting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Scene" ADD CONSTRAINT "Scene_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SceneCharacter" ADD CONSTRAINT "SceneCharacter_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "public"."Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SceneCharacter" ADD CONSTRAINT "SceneCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "public"."Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SceneBreakdownItem" ADD CONSTRAINT "SceneBreakdownItem_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "public"."Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SceneBreakdownItem" ADD CONSTRAINT "SceneBreakdownItem_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SceneBreakdownItem" ADD CONSTRAINT "SceneBreakdownItem_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Clue" ADD CONSTRAINT "Clue_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebsiteSettings" ADD CONSTRAINT "WebsiteSettings_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "public"."WebsiteTheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MysteryTipSubmission" ADD CONSTRAINT "MysteryTipSubmission_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "public"."MysteryTip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MysteryTipSubmission" ADD CONSTRAINT "MysteryTipSubmission_clueId_fkey" FOREIGN KEY ("clueId") REFERENCES "public"."Clue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Guess" ADD CONSTRAINT "Guess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Guess" ADD CONSTRAINT "Guess_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Rehearsal" ADD CONSTRAINT "Rehearsal_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Rehearsal" ADD CONSTRAINT "Rehearsal_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."RehearsalTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RehearsalInvitee" ADD CONSTRAINT "RehearsalInvitee_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "public"."Rehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RehearsalInvitee" ADD CONSTRAINT "RehearsalInvitee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppRolePermission" ADD CONSTRAINT "AppRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."AppRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppRolePermission" ADD CONSTRAINT "AppRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "public"."Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserAppRole" ADD CONSTRAINT "UserAppRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserAppRole" ADD CONSTRAINT "UserAppRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."AppRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberMeasurement" ADD CONSTRAINT "MemberMeasurement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberSize" ADD CONSTRAINT "MemberSize_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DietaryRestriction" ADD CONSTRAINT "DietaryRestriction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RehearsalProposal" ADD CONSTRAINT "RehearsalProposal_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RehearsalProposal" ADD CONSTRAINT "RehearsalProposal_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RehearsalProposal" ADD CONSTRAINT "RehearsalProposal_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "public"."Rehearsal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Availability" ADD CONSTRAINT "Availability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BlockedDay" ADD CONSTRAINT "BlockedDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SyncEvent" ADD CONSTRAINT "SyncEvent_clientMutationId_fkey" FOREIGN KEY ("clientMutationId") REFERENCES "public"."SyncMutation"("clientMutationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinanceEntry" ADD CONSTRAINT "FinanceEntry_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinanceEntry" ADD CONSTRAINT "FinanceEntry_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "public"."FinanceBudget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinanceEntry" ADD CONSTRAINT "FinanceEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinanceEntry" ADD CONSTRAINT "FinanceEntry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinanceEntry" ADD CONSTRAINT "FinanceEntry_memberPaidById_fkey" FOREIGN KEY ("memberPaidById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinanceAttachment" ADD CONSTRAINT "FinanceAttachment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "public"."FinanceEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinanceBudget" ADD CONSTRAINT "FinanceBudget_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinanceLog" ADD CONSTRAINT "FinanceLog_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "public"."FinanceEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinanceLog" ADD CONSTRAINT "FinanceLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "public"."Rehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "public"."Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Issue" ADD CONSTRAINT "Issue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Issue" ADD CONSTRAINT "Issue_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IssueComment" ADD CONSTRAINT "IssueComment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "public"."Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IssueComment" ADD CONSTRAINT "IssueComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PhotoConsent" ADD CONSTRAINT "PhotoConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PhotoConsent" ADD CONSTRAINT "PhotoConsent_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GalleryItem" ADD CONSTRAINT "GalleryItem_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberInvite" ADD CONSTRAINT "MemberInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberInvite" ADD CONSTRAINT "MemberInvite_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberInviteRedemption" ADD CONSTRAINT "MemberInviteRedemption_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "public"."MemberInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberInviteRedemption" ADD CONSTRAINT "MemberInviteRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Interest" ADD CONSTRAINT "Interest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserInterest" ADD CONSTRAINT "UserInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserInterest" ADD CONSTRAINT "UserInterest_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "public"."Interest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberRolePreference" ADD CONSTRAINT "MemberRolePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberOnboardingProfile" ADD CONSTRAINT "MemberOnboardingProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberOnboardingProfile" ADD CONSTRAINT "MemberOnboardingProfile_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "public"."MemberInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberOnboardingProfile" ADD CONSTRAINT "MemberOnboardingProfile_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "public"."MemberInviteRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberOnboardingProfile" ADD CONSTRAINT "MemberOnboardingProfile_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionMembership" ADD CONSTRAINT "ProductionMembership_showId_fkey" FOREIGN KEY ("showId") REFERENCES "public"."Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionMembership" ADD CONSTRAINT "ProductionMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnalyticsPageView" ADD CONSTRAINT "AnalyticsPageView_analyticsSessionId_fkey" FOREIGN KEY ("analyticsSessionId") REFERENCES "public"."AnalyticsSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnalyticsTrafficAttribution" ADD CONSTRAINT "AnalyticsTrafficAttribution_analyticsSessionId_fkey" FOREIGN KEY ("analyticsSessionId") REFERENCES "public"."AnalyticsSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TicketScanEvent" ADD CONSTRAINT "TicketScanEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

