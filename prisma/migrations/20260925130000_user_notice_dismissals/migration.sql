-- CreateTable
CREATE TABLE "UserNoticeDismissal" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNoticeDismissal_pkey" PRIMARY KEY ("userId","key")
);

-- AddForeignKey
ALTER TABLE "UserNoticeDismissal" ADD CONSTRAINT "UserNoticeDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
