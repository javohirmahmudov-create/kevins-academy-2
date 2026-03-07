-- CreateTable
CREATE TABLE "VocabularyLiveSignal" (
    "id" SERIAL NOT NULL,
    "roomKey" TEXT NOT NULL,
    "fromStudentId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VocabularyLiveSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VocabularyLiveSignal_roomKey_createdAt_idx" ON "VocabularyLiveSignal"("roomKey", "createdAt");

-- CreateIndex
CREATE INDEX "VocabularyLiveSignal_roomKey_fromStudentId_createdAt_idx" ON "VocabularyLiveSignal"("roomKey", "fromStudentId", "createdAt");
