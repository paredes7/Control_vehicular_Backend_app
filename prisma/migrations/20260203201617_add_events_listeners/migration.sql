-- CreateEnum
CREATE TYPE "ContractEventType" AS ENUM ('MINTED', 'BURNED', 'REDEMPTION_REQUESTED', 'REDEMPTION_FINALIZED', 'REDEMPTION_REJECTED', 'CONFISCATED', 'SYSTEM_PAUSED', 'SYSTEM_UNPAUSED', 'ADDED_TO_BLACKLIST', 'REMOVED_FROM_BLACKLIST', 'TOKENS_RECOVERED');

-- CreateEnum
CREATE TYPE "BlacklistAction" AS ENUM ('ADDED', 'REMOVED', 'CONFISCATED');

-- CreateTable
CREATE TABLE "event_logs" (
    "id" TEXT NOT NULL,
    "eventType" "ContractEventType" NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "userAddress" TEXT,
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "amount" DECIMAL(36,18),
    "rawData" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blacklist_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "BlacklistAction" NOT NULL,
    "reason" TEXT,
    "actionBy" TEXT NOT NULL,
    "isCurrentlyBlocked" BOOLEAN NOT NULL DEFAULT true,
    "confiscatedWalletAmount" DECIMAL(36,18),
    "confiscatedPendingAmount" DECIMAL(36,18),
    "safeTxHash" TEXT,
    "executionTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blacklist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_logs_eventType_createdAt_idx" ON "event_logs"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "event_logs_txHash_idx" ON "event_logs"("txHash");

-- CreateIndex
CREATE INDEX "event_logs_userAddress_createdAt_idx" ON "event_logs"("userAddress", "createdAt");

-- CreateIndex
CREATE INDEX "event_logs_blockNumber_idx" ON "event_logs"("blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "event_logs_txHash_logIndex_key" ON "event_logs"("txHash", "logIndex");

-- CreateIndex
CREATE UNIQUE INDEX "blacklist_entries_safeTxHash_key" ON "blacklist_entries"("safeTxHash");

-- CreateIndex
CREATE INDEX "blacklist_entries_userId_createdAt_idx" ON "blacklist_entries"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "blacklist_entries_action_createdAt_idx" ON "blacklist_entries"("action", "createdAt");

-- CreateIndex
CREATE INDEX "blacklist_entries_isCurrentlyBlocked_idx" ON "blacklist_entries"("isCurrentlyBlocked");

-- AddForeignKey
ALTER TABLE "blacklist_entries" ADD CONSTRAINT "blacklist_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
