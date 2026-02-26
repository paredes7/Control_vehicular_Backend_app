/*
  Warnings:

  - You are about to drop the column `documentUrl` on the `verification_requests` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "verification_requests" DROP COLUMN "documentUrl";
