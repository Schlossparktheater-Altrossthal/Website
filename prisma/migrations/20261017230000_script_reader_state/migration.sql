CREATE TABLE "ScriptReaderState" (
    "userId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScriptReaderState_pkey" PRIMARY KEY ("userId","showId")
);

ALTER TABLE "ScriptReaderState" ADD CONSTRAINT "ScriptReaderState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScriptReaderState" ADD CONSTRAINT "ScriptReaderState_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
