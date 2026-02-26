import { Module } from '@nestjs/common';
import { ListenerService } from './listener.service';
import { ListenerController } from './listener.controller';
import { ConfigModule } from '@nestjs/config';
import { EventProcessorService } from './processors/event-processor.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [ListenerController,],
  providers: [ListenerService, EventProcessorService],
  exports: [EventProcessorService]
})
export class ListenerModule { }
