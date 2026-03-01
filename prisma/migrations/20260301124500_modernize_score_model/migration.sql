-- Modernize score model for level-based scoring, mock exams, and analytics
ALTER TABLE "Score" ADD COLUMN IF NOT EXISTS "level" TEXT;
ALTER TABLE "Score" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Score" ADD COLUMN IF NOT EXISTS "scoreType" TEXT NOT NULL DEFAULT 'weekly';
ALTER TABLE "Score" ADD COLUMN IF NOT EXISTS "maxScore" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "Score" ADD COLUMN IF NOT EXISTS "overallPercent" DOUBLE PRECISION;
ALTER TABLE "Score" ADD COLUMN IF NOT EXISTS "mockScore" DOUBLE PRECISION;
ALTER TABLE "Score" ADD COLUMN IF NOT EXISTS "examDateTime" TIMESTAMP(3);
ALTER TABLE "Score" ADD COLUMN IF NOT EXISTS "breakdown" JSONB;

CREATE INDEX IF NOT EXISTS "Score_scoreType_idx" ON "Score"("scoreType");
CREATE INDEX IF NOT EXISTS "Score_studentId_scoreType_createdAt_idx" ON "Score"("studentId", "scoreType", "createdAt");
