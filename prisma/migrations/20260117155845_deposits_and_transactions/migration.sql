/*
  Warnings:

  - You are about to drop the column `completedAt` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `transactions` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `transactions` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(36,18)`.
  - The `status` column on the `transactions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[txHash]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `network` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `transactions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "FiatCurrency" AS ENUM ('BOB', 'PEN');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MINTED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('MINT', 'BURN', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "Network" AS ENUM ('BNB_CHAIN_MAINNET', 'BNB_CHAIN_TESTNET');

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "completedAt",
DROP COLUMN "currency",
ADD COLUMN     "blockNumber" INTEGER,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "depositId" TEXT,
ADD COLUMN     "network" "Network" NOT NULL,
ADD COLUMN     "txHash" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3),
DROP COLUMN "type",
ADD COLUMN     "type" "TransactionType" NOT NULL,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(36,18),
DROP COLUMN "status",
ADD COLUMN     "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "deposits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" "FiatCurrency" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "feeRate" DOUBLE PRECISION NOT NULL,
    "serviceFee" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "rateUsed" DOUBLE PRECISION NOT NULL,
    "expectedBOBH" DOUBLE PRECISION NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "status" "DepositStatus" NOT NULL DEFAULT 'PENDING',
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "mintTxHash" TEXT,
    "mintedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deposits_referenceCode_key" ON "deposits"("referenceCode");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_txHash_key" ON "transactions"("txHash");

-- CreateIndex
CREATE INDEX "transactions_userId_createdAt_idx" ON "transactions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "transactions_txHash_idx" ON "transactions"("txHash");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "deposits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
