-- AlterTable
ALTER TABLE "withdrawal_details" ADD COLUMN     "cloudinaryPublicId" TEXT,
ADD COLUMN     "logProofUrl" TEXT,
ADD COLUMN     "proofUploadedAt" TIMESTAMP(3);
