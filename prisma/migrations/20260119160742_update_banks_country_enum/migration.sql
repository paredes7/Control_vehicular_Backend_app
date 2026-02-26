/*
  Warnings:

  - Changed the type of `country` on the `Banks` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "country_banks" AS ENUM ('Bolivia', 'PERU');

-- AlterTable
ALTER TABLE "Banks" DROP COLUMN "country",
ADD COLUMN     "country" "country_banks" NOT NULL;
