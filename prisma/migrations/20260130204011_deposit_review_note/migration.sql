-- AlterEnum
ALTER TYPE "FiatOperationStatus" ADD VALUE 'NEED_CORRECTION';

-- AlterTable
ALTER TABLE "deposit_details" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- AlterTable
ALTER TABLE "withdrawal_details" ALTER COLUMN "createdAt" DROP NOT NULL,
ALTER COLUMN "updatedAt" DROP NOT NULL;

-- DropEnum
DROP TYPE "DepositStatus";
