/*
  Warnings:

  - A unique constraint covering the columns `[safeTxHash]` on the table `deposit_details` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "deposit_details" ADD COLUMN     "safeProposedAt" TIMESTAMP(3),
ADD COLUMN     "safeTxHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "deposit_details_safeTxHash_key" ON "deposit_details"("safeTxHash");
