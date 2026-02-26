-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "bankId" INTEGER NOT NULL,
    "transactionId" TEXT,
    "accountNumber" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_accounts_userId_idx" ON "bank_accounts"("userId");

-- CreateIndex
CREATE INDEX "bank_accounts_bankId_idx" ON "bank_accounts"("bankId");

-- CreateIndex
CREATE INDEX "bank_accounts_accountNumber_idx" ON "bank_accounts"("accountNumber");

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
