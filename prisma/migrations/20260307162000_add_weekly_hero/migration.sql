CREATE TABLE "WeeklyHero" (
  "id" SERIAL NOT NULL,
  "weekKey" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "studentId" INTEGER NOT NULL,
  "adminId" INTEGER,
  "studentName" TEXT NOT NULL,
  "duelWins" INTEGER NOT NULL DEFAULT 0,
  "proctorBest" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "badgeStartAt" TIMESTAMP(3) NOT NULL,
  "badgeEndAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyHero_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklyHero_weekKey_rank_key" ON "WeeklyHero"("weekKey", "rank");
CREATE INDEX "WeeklyHero_studentId_badgeEndAt_idx" ON "WeeklyHero"("studentId", "badgeEndAt");
CREATE INDEX "WeeklyHero_weekKey_createdAt_idx" ON "WeeklyHero"("weekKey", "createdAt");
