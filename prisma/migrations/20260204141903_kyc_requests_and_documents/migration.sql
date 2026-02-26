/*
  Warnings:

  - A unique constraint covering the columns `[kycRequestId,docType]` on the table `kyc_documents` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `folder` to the `kyc_documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kycRequestId` to the `kyc_documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `publicId` to the `kyc_documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `resourceType` to the `kyc_documents` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `docType` on the `kyc_documents` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "KycDocumentType" AS ENUM ('ID_FRONT', 'ID_BACK', 'LIVENESS_VIDEO');

-- CreateEnum
CREATE TYPE "KycResourceType" AS ENUM ('image', 'video', 'raw');

-- AlterEnum
ALTER TYPE "KycStatus" ADD VALUE 'NEED_CORRECTION';

-- AlterTable
ALTER TABLE "kyc_documents" ADD COLUMN     "bytes" INTEGER,
ADD COLUMN     "folder" TEXT NOT NULL,
ADD COLUMN     "kycRequestId" TEXT NOT NULL,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "publicId" TEXT NOT NULL,
ADD COLUMN     "resourceType" "KycResourceType" NOT NULL,
DROP COLUMN "docType",
ADD COLUMN     "docType" "KycDocumentType" NOT NULL,
ALTER COLUMN "docUrl" DROP NOT NULL,
ALTER COLUMN "uploadedAt" DROP NOT NULL;

-- CreateTable
CREATE TABLE "kyc_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kyc_documents_kycRequestId_idx" ON "kyc_documents"("kycRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_documents_kycRequestId_docType_key" ON "kyc_documents"("kycRequestId", "docType");

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_kycRequestId_fkey" FOREIGN KEY ("kycRequestId") REFERENCES "kyc_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_requests" ADD CONSTRAINT "kyc_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_requests" ADD CONSTRAINT "kyc_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
