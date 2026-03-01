-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "month" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- Cleanup orphaned student references before adding foreign keys
UPDATE "Attendance" a
SET "studentId" = NULL
WHERE a."studentId" IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM "Student" s
		WHERE s."id" = a."studentId"
	);

UPDATE "Payment" p
SET "studentId" = NULL
WHERE p."studentId" IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM "Student" s
		WHERE s."id" = p."studentId"
	);

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
