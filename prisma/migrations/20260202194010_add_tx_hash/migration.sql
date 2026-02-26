/*
  Warnings:

  - Added the required column `TxHash` to the `withdrawal_details` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "withdrawal_details" ADD COLUMN     "TxHash" TEXT NOT NULL;
