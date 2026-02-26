-- AlterTable
ALTER TABLE "users" ADD COLUMN     "resetPasswordExpiry" TIMESTAMP(3),
ADD COLUMN     "resetPasswordToken" TEXT;
