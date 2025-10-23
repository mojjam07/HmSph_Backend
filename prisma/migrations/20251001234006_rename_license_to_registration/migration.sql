/*
  Warnings:

  - You are about to rename the column `licenseNumber` to `registrationNumber` on the `Agent` table.
  - A unique constraint covering the columns `[registrationNumber]` on the table `Agent` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Agent_licenseNumber_key";

-- AlterTable
ALTER TABLE "Agent" RENAME COLUMN "licenseNumber" TO "registrationNumber";

-- CreateIndex
CREATE UNIQUE INDEX "Agent_registrationNumber_key" ON "Agent"("registrationNumber");
