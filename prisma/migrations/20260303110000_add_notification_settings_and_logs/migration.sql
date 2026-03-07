-- AlterTable
ALTER TABLE "Admin"
ADD COLUMN "notifyTelegram" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notifySms" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "NotificationLog" (
  "id" SERIAL NOT NULL,
  "channel" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "recipient" TEXT,
  "adminId" INTEGER,
  "studentId" INTEGER,
  "message" TEXT NOT NULL,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationLog_adminId_createdAt_idx" ON "NotificationLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_channel_status_createdAt_idx" ON "NotificationLog"("channel", "status", "createdAt");
