/*
  Warnings:

  - You are about to alter the column `feeRate` on the `deposits` table. The data in that column could be lost. The data in that column will be cast from `Decimal(36,18)` to `Decimal(10,6)`.

*/
-- AlterTable
ALTER TABLE "deposits" ALTER COLUMN "feeRate" SET DATA TYPE DECIMAL(10,6),
ALTER COLUMN "rateUsed" DROP NOT NULL;
