CREATE TABLE "VocabularySessionControl" (
  "id" SERIAL NOT NULL,
  "adminId" INTEGER NOT NULL,
  "sessionDayKey" TEXT,
  "sessionActive" BOOLEAN NOT NULL DEFAULT false,
  "duelEnabled" BOOLEAN NOT NULL DEFAULT false,
  "startedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VocabularySessionControl_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VocabularySessionControl_adminId_key" ON "VocabularySessionControl"("adminId");
CREATE INDEX "VocabularySessionControl_adminId_sessionDayKey_idx" ON "VocabularySessionControl"("adminId", "sessionDayKey");
