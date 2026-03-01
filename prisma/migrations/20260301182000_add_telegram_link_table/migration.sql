-- CreateTable
CREATE TABLE "TelegramLink" (
    "id" SERIAL NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "lastRawPhone" TEXT,
    "lastUsername" TEXT,
    "lastFirstName" TEXT,
    "lastLastName" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLink_phoneNormalized_key" ON "TelegramLink"("phoneNormalized");
