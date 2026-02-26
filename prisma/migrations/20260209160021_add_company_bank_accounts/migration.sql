-- CreateTable
CREATE TABLE "company_bank_accounts" (
    "id" TEXT NOT NULL,
    "currency" "FiatCurrency" NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "cci" TEXT,
    "qrImageUrl" TEXT,
    "qrPublicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_bank_accounts_currency_idx" ON "company_bank_accounts"("currency");

-- CreateIndex
CREATE INDEX "company_bank_accounts_bankName_idx" ON "company_bank_accounts"("bankName");

-- CreateIndex
CREATE UNIQUE INDEX "company_bank_accounts_currency_key" ON "company_bank_accounts"("currency");
