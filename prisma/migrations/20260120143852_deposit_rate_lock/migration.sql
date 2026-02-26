/*
  Warnings:

  - You are about to alter the column `amount` on the `deposits` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(36,18)`.
  - You are about to alter the column `feeRate` on the `deposits` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(36,18)`.
  - You are about to alter the column `serviceFee` on the `deposits` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(36,18)`.
  - You are about to alter the column `totalAmount` on the `deposits` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(36,18)`.
  - You are about to alter the column `rateUsed` on the `deposits` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(36,18)`.
  - You are about to alter the column `expectedBOBH` on the `deposits` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(36,18)`.
  - Added the required column `updatedAt` to the `deposits` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DepositStatus" ADD VALUE 'PROOF_SUBMITTED';
ALTER TYPE "DepositStatus" ADD VALUE 'RATE_EXPIRED';

-- AlterTable
ALTER TABLE "deposits" ADD COLUMN     "proofFileName" TEXT,
ADD COLUMN     "proofMimeType" TEXT,
ADD COLUMN     "proofUploadedAt" TIMESTAMP(3),
ADD COLUMN     "proofUrl" TEXT,
ADD COLUMN     "rateExpiresAt" TIMESTAMP(3),
ADD COLUMN     "rateQuotedAt" TIMESTAMP(3),
ADD COLUMN     "rateSource" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(36,18),
ALTER COLUMN "feeRate" SET DATA TYPE DECIMAL(36,18),
ALTER COLUMN "serviceFee" SET DATA TYPE DECIMAL(36,18),
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(36,18),
ALTER COLUMN "rateUsed" SET DATA TYPE DECIMAL(36,18),
ALTER COLUMN "expectedBOBH" SET DATA TYPE DECIMAL(36,18);

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
