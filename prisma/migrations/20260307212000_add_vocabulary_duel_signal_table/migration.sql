-- CreateTable
CREATE TABLE "VocabularyDuelSignal" (
    "id" SERIAL NOT NULL,
    "duelId" INTEGER NOT NULL,
    "fromStudentId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VocabularyDuelSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VocabularyDuelSignal_duelId_createdAt_idx" ON "VocabularyDuelSignal"("duelId", "createdAt");

-- CreateIndex
CREATE INDEX "VocabularyDuelSignal_duelId_fromStudentId_createdAt_idx" ON "VocabularyDuelSignal"("duelId", "fromStudentId", "createdAt");
