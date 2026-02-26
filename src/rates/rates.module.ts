import { Module } from '@nestjs/common';
import { RatesController } from './rates.controller';
import { RatesService } from './rates.service';
import { BinanceP2PRatesProvider } from './binance-p2p-rates.provider';

@Module({
  controllers: [RatesController],
  providers: [RatesService, BinanceP2PRatesProvider],
  exports: [RatesService],
})
export class RatesModule {}
