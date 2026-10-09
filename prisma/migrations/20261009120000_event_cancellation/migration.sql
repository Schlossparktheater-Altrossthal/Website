-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledFromStatus" "EventStatus";
