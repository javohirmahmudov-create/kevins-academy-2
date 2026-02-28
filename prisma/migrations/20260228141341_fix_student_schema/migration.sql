/*
  Warnings:

  - You are about to drop the column `groupId` on the `Student` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `Student` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_groupId_fkey";

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "groupId",
ADD COLUMN     "group" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");
