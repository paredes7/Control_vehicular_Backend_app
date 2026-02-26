import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BinanceP2PRatesProvider } from './binance-p2p-rates.provider';

@Injectable()
export class RatesService {
  constructor(private readonly binanceProvider: BinanceP2PRatesProvider) {}

  private getCacheSeconds(): number {
    const raw = Number(process.env.RATE_CACHE_SECONDS ?? '30');
    if (!Number.isFinite(raw) || raw <= 0) return 30;
    return raw;
  }

  async getPenToBobRate() {
    const cacheSeconds = this.getCacheSeconds();

    try {
      return await this.binanceProvider.getPenToBobRateCached(cacheSeconds);
    } catch (error) {
      const r = Number(process.env.PEN_TO_BOB_RATE ?? '0');
      if (!Number.isFinite(r) || r <= 0) {
        throw new InternalServerErrorException(
          'No se pudo obtener tasa PEN->BOB desde Binance y PEN_TO_BOB_RATE invalido o no definido',
        );
      }
      return {
        rate: new Prisma.Decimal(r),
        source: 'ENV',
        updatedAt: new Date(),
        cacheSeconds,
      };
    }
  }
}
