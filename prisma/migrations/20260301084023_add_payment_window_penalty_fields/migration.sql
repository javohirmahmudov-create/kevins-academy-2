-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "penaltyPerDay" INTEGER NOT NULL DEFAULT 10000,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "studentName" TEXT;
