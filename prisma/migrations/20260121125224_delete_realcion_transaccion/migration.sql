/*
  Warnings:

  - You are about to drop the column `transactionId` on the `bank_accounts` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "bank_accounts" DROP CONSTRAINT "bank_accounts_transactionId_fkey";

-- AlterTable
ALTER TABLE "bank_accounts" DROP COLUMN "transactionId";
