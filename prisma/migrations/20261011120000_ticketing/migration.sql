-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('online', 'phone', 'free_ticket', 'box_office');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('pending', 'confirmed', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "ReservationPaymentStatus" AS ENUM ('open', 'paid', 'free');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('waiting', 'notified', 'done');

-- CreateTable
CREATE TABLE "TicketingSettings" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "holdMinutes" INTEGER NOT NULL DEFAULT 120,
    "maxSeatsPerBooking" INTEGER NOT NULL DEFAULT 10,
    "freeTicketsPerMember" INTEGER NOT NULL DEFAULT 2,
    "freeTicketDeadline" TIMESTAMP(3),
    "infoText" TEXT,
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketCategory" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "needsSeat" BOOLEAN NOT NULL DEFAULT true,
    "onlineBookable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceTicketing" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "onlineLimit" INTEGER,
    "boxOfficeReserve" INTEGER NOT NULL DEFAULT 0,
    "salesOpen" BOOLEAN NOT NULL DEFAULT true,
    "salesEndAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceTicketing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "source" "ReservationSource" NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'pending',
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "note" TEXT,
    "internalNote" TEXT,
    "seats" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" "ReservationPaymentStatus" NOT NULL DEFAULT 'open',
    "holdUntil" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "checkedInCount" INTEGER NOT NULL DEFAULT 0,
    "memberId" TEXT,
    "createdByUserId" TEXT,
    "createdByAccessId" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "eventCancelNoticeAt" TIMESTAMP(3),
    "anonymizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationItem" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "categoryId" TEXT,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
    "needsSeat" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReservationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationCheckIn" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "clientMutationId" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "byUserId" TEXT,
    "byAccessId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreeTicketAllowance" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "FreeTicketAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoxOfficeAccess" (
    "id" TEXT NOT NULL,
    "showId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "canCheckIn" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoxOfficeAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'waiting',
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TicketingSettings_showId_key" ON "TicketingSettings"("showId");

-- CreateIndex
CREATE INDEX "TicketCategory_showId_sortOrder_idx" ON "TicketCategory"("showId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceTicketing_eventId_key" ON "PerformanceTicketing"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_code_key" ON "Reservation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_tokenHash_key" ON "Reservation"("tokenHash");

-- CreateIndex
CREATE INDEX "Reservation_eventId_status_idx" ON "Reservation"("eventId", "status");

-- CreateIndex
CREATE INDEX "Reservation_showId_memberId_idx" ON "Reservation"("showId", "memberId");

-- CreateIndex
CREATE INDEX "Reservation_status_holdUntil_idx" ON "Reservation"("status", "holdUntil");

-- CreateIndex
CREATE INDEX "ReservationItem_reservationId_idx" ON "ReservationItem"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationCheckIn_clientMutationId_key" ON "ReservationCheckIn"("clientMutationId");

-- CreateIndex
CREATE INDEX "ReservationCheckIn_reservationId_idx" ON "ReservationCheckIn"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "FreeTicketAllowance_showId_userId_key" ON "FreeTicketAllowance"("showId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BoxOfficeAccess_tokenHash_key" ON "BoxOfficeAccess"("tokenHash");

-- CreateIndex
CREATE INDEX "WaitlistEntry_eventId_status_idx" ON "WaitlistEntry"("eventId", "status");

-- AddForeignKey
ALTER TABLE "TicketingSettings" ADD CONSTRAINT "TicketingSettings_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCategory" ADD CONSTRAINT "TicketCategory_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceTicketing" ADD CONSTRAINT "PerformanceTicketing_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationCheckIn" ADD CONSTRAINT "ReservationCheckIn_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeTicketAllowance" ADD CONSTRAINT "FreeTicketAllowance_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeTicketAllowance" ADD CONSTRAINT "FreeTicketAllowance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoxOfficeAccess" ADD CONSTRAINT "BoxOfficeAccess_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoxOfficeAccess" ADD CONSTRAINT "BoxOfficeAccess_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
