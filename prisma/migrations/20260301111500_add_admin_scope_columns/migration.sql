-- Add admin scoping columns (idempotent)
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "adminId" INTEGER;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "adminId" INTEGER;
ALTER TABLE "Parent" ADD COLUMN IF NOT EXISTS "adminId" INTEGER;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "adminId" INTEGER;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "adminId" INTEGER;
ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "adminId" INTEGER;
ALTER TABLE "Score" ADD COLUMN IF NOT EXISTS "adminId" INTEGER;

CREATE INDEX IF NOT EXISTS "Group_adminId_idx" ON "Group"("adminId");
CREATE INDEX IF NOT EXISTS "Student_adminId_idx" ON "Student"("adminId");
CREATE INDEX IF NOT EXISTS "Parent_adminId_idx" ON "Parent"("adminId");
CREATE INDEX IF NOT EXISTS "Payment_adminId_idx" ON "Payment"("adminId");
CREATE INDEX IF NOT EXISTS "Attendance_adminId_idx" ON "Attendance"("adminId");
CREATE INDEX IF NOT EXISTS "Material_adminId_idx" ON "Material"("adminId");
CREATE INDEX IF NOT EXISTS "Score_adminId_idx" ON "Score"("adminId");
