/*
  Warnings:

  - Added the required column `burnedBOBH` to the `withdrawal_details` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fiatSent` to the `withdrawal_details` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "withdrawal_details" ADD COLUMN     "burnedBOBH" DECIMAL(36,18) NOT NULL,
ADD COLUMN     "fiatSent" DECIMAL(36,18) NOT NULL,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "payoutTxRef" TEXT;
