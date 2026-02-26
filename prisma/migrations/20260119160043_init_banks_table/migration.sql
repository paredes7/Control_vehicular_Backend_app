-- CreateTable
CREATE TABLE "Banks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "logo_url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Banks_pkey" PRIMARY KEY ("id")
);
