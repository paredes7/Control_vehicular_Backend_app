import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { SafeModule } from '../safe/safe.module';
import { MintSyncJob } from './mint-sync.job';

@Module({
  imports: [PrismaModule, SafeModule],
  providers: [MintSyncJob],
})
export class JobsModule {}
