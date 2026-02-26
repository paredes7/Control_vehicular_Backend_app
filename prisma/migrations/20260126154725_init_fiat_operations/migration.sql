/*
  Warnings:

  - You are about to drop the `deposits` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `transactions` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `isGoogleAccount` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "FiatOperationType" AS ENUM ('DEPOSIT', 'WITHDRAW');

-- CreateEnum
CREATE TYPE "FiatOperationStatus" AS ENUM ('PENDING', 'PROOF_SUBMITTED', 'RATE_EXPIRED', 'APPROVED', 'REJECTED', 'PROCESSED', 'FAILED');

-- DropForeignKey
ALTER TABLE "deposits" DROP CONSTRAINT "deposits_userId_fkey";

-- DropForeignKey
ALTER TABLE "deposits" DROP CONSTRAINT "deposits_validatedById_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_depositId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_userId_fkey";

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "isGoogleAccount" SET NOT NULL;

-- DropTable
DROP TABLE "deposits";

-- DropTable
DROP TABLE "transactions";

-- CreateTable
CREATE TABLE "fiat_operations" (
    "id" TEXT NOT NULL,
    "type" "FiatOperationType" NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" "FiatCurrency" NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "feeRate" DECIMAL(10,6) NOT NULL,
    "serviceFee" DECIMAL(36,18) NOT NULL,
    "totalAmount" DECIMAL(36,18) NOT NULL,
    "rateUsed" DECIMAL(36,18),
    "rateSource" TEXT,
    "rateQuotedAt" TIMESTAMP(3),
    "rateExpiresAt" TIMESTAMP(3),
    "referenceCode" TEXT NOT NULL,
    "status" "FiatOperationStatus" NOT NULL DEFAULT 'PENDING',
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "fiat_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_details" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "expectedBOBH" DECIMAL(36,18) NOT NULL,
    "mintTxHash" TEXT,
    "mintedAt" TIMESTAMP(3),
    "proofUrl" TEXT,
    "proofUploadedAt" TIMESTAMP(3),
    "proofFileName" TEXT,
    "proofMimeType" TEXT,

    CONSTRAINT "deposit_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_details" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "bankAccountId" BIGINT NOT NULL,

    CONSTRAINT "withdrawal_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiat_operations_referenceCode_key" ON "fiat_operations"("referenceCode");

-- CreateIndex
CREATE INDEX "fiat_operations_userId_createdAt_idx" ON "fiat_operations"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "fiat_operations_status_createdAt_idx" ON "fiat_operations"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_details_operationId_key" ON "deposit_details"("operationId");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_details_operationId_key" ON "withdrawal_details"("operationId");

-- CreateIndex
CREATE INDEX "withdrawal_details_bankAccountId_idx" ON "withdrawal_details"("bankAccountId");

-- AddForeignKey
ALTER TABLE "fiat_operations" ADD CONSTRAINT "fiat_operations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiat_operations" ADD CONSTRAINT "fiat_operations_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_details" ADD CONSTRAINT "deposit_details_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "fiat_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_details" ADD CONSTRAINT "withdrawal_details_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_details" ADD CONSTRAINT "withdrawal_details_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "fiat_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
