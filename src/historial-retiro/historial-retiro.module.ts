import { Module } from '@nestjs/common';
import { HistorialRetiroService } from './historial-retiro.service';
import { HistorialRetiroController } from './historial-retiro.controller';

@Module({
  controllers: [HistorialRetiroController],
  providers: [HistorialRetiroService],
})
export class HistorialRetiroModule {}
