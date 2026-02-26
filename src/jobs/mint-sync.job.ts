import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FiatOperationStatus, FiatOperationType } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { SafeService } from '../safe/safe.service';

@Injectable()
export class MintSyncJob {
  private readonly logger = new Logger(MintSyncJob.name);
  private running = false;
  private readonly backoffMs = 5 * 60 * 1000;
  private readonly lastFailureAt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly safeService: SafeService,
  ) {}

  @Cron('*/40 * * * * *')
  async handleCron() {
    if (this.running) {
      this.logger.warn('Mint sync skipped: previous run still in progress.');
      return;
    }

    this.running = true;
    let checked = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    try {
      const rows = await this.prisma.fiatOperation.findMany({
        where: {
          type: FiatOperationType.DEPOSIT,
          status: { not: FiatOperationStatus.PROCESSED },
          deposit: {
            is: {
              safeTxHash: { not: null },
              mintTxHash: null,
            },
          },
        },
        take: 50,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          deposit: { select: { safeTxHash: true } },
        },
      });

      for (const row of rows) {
        const safeTxHash = row.deposit?.safeTxHash;
        if (!safeTxHash) continue;

        const lastFail = this.lastFailureAt.get(safeTxHash);
        if (lastFail && Date.now() - lastFail < this.backoffMs) {
          skipped += 1;
          continue;
        }

        checked += 1;

        try {
          const exec = await this.safeService.getSafeTxExecution(safeTxHash);
          if (!exec.executed || !exec.txHash) continue;

          const now = new Date();
          await this.prisma.$transaction([
            this.prisma.depositDetail.update({
              where: { operationId: row.id },
              data: {
                mintTxHash: exec.txHash,
                mintedAt: now,
              },
            }),
            this.prisma.fiatOperation.update({
              where: { id: row.id },
              data: {
                status: FiatOperationStatus.PROCESSED,
                processedAt: now,
              },
            }),
          ]);

          updated += 1;
        } catch (error: any) {
          failed += 1;
          this.lastFailureAt.set(safeTxHash, Date.now());
          const status = error?.response?.status ?? error?.status;
          if (status === 404) {
            this.logger.warn(`Safe tx not found: ${safeTxHash}`);
          } else {
            this.logger.error(
              `Mint sync failed for ${safeTxHash}: ${error?.message ?? 'unknown error'}`,
              error?.stack,
            );
          }
        }
      }
    } finally {
      this.running = false;
      this.logger.log(
        `Mint sync summary: checked=${checked} updated=${updated} skipped=${skipped} failed=${failed}`,
      );
    }
  }
}
