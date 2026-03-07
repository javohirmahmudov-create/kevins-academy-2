CREATE TABLE "VocabularyDuel" (
  "id" SERIAL NOT NULL,
  "adminId" INTEGER,
  "challengerId" INTEGER NOT NULL,
  "opponentId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "initiatorMode" TEXT NOT NULL DEFAULT 'manual',
  "acceptedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VocabularyDuel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VocabularyDuel_adminId_status_createdAt_idx" ON "VocabularyDuel"("adminId", "status", "createdAt");
CREATE INDEX "VocabularyDuel_challengerId_status_createdAt_idx" ON "VocabularyDuel"("challengerId", "status", "createdAt");
CREATE INDEX "VocabularyDuel_opponentId_status_createdAt_idx" ON "VocabularyDuel"("opponentId", "status", "createdAt");
