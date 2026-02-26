import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SafeService } from './safe.service';

@Module({
  imports: [ConfigModule],
  providers: [SafeService],
  exports: [SafeService],
})
export class SafeModule {}
