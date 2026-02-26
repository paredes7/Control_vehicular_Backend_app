import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type FiatCurrency = 'PEN' | 'BOB';

type CacheEntry = {
  rate: Prisma.Decimal;
  updatedAt: Date;
  expiresAtMs: number;
  source: string;
};

@Injectable()
export class BinanceP2PRatesProvider {
  private cache: CacheEntry | null = null;

  async getPenToBobRateCached(cacheSeconds: number) {
    const now = Date.now();

    if (this.cache && now < this.cache.expiresAtMs) {
      return {
        rate: this.cache.rate,
        source: this.cache.source,
        updatedAt: this.cache.updatedAt,
        cacheSeconds,
      };
    }

    try {
      const fresh = await this.fetchPenToBobFromBinance();
      this.cache = {
        rate: fresh.rate,
        updatedAt: fresh.updatedAt,
        expiresAtMs: now + cacheSeconds * 1000,
        source: 'Binance P2P',
      };

      return {
        rate: fresh.rate,
        source: 'Binance P2P',
        updatedAt: fresh.updatedAt,
        cacheSeconds,
      };
    } catch (error) {
      if (this.cache) {
        return {
          rate: this.cache.rate,
          source: this.cache.source,
          updatedAt: this.cache.updatedAt,
          cacheSeconds,
        };
      }
      throw error;
    }
  }

  private async fetchP2PPrice(fiat: FiatCurrency): Promise<number> {
    const response = await fetch(
      'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: 'USDT',
          fiat,
          tradeType: 'BUY',
          page: 1,
          rows: 20,
          payTypes: [],
          publisherType: 'merchant',
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Binance P2P error: ${response.status}`);
    }

    const data = await response.json().catch(() => null);
    const ranked = (data?.data || [])
      .filter(
        (item: any) =>
          item?.adv &&
          item?.advertiser &&
          Number(item.adv.tradableQuantity) > 0,
      )
      .sort((a: any, b: any) => {
        if (b.advertiser.monthFinishRate !== a.advertiser.monthFinishRate) {
          return b.advertiser.monthFinishRate - a.advertiser.monthFinishRate;
        }
        if (b.advertiser.monthOrderCount !== a.advertiser.monthOrderCount) {
          return b.advertiser.monthOrderCount - a.advertiser.monthOrderCount;
        }
        return parseFloat(a.adv.price) - parseFloat(b.adv.price);
      });

    const top = ranked[0];
    const price = Number(top?.adv?.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error('Binance P2P price invalido');
    }

    return price;
  }

  private async fetchPenToBobFromBinance() {
    const [penPrice, bobPrice] = await Promise.all([
      this.fetchP2PPrice('PEN'),
      this.fetchP2PPrice('BOB'),
    ]);

    if (!Number.isFinite(penPrice) || !Number.isFinite(bobPrice)) {
      throw new Error('Binance P2P data invalido');
    }

    const penToBob = Number((bobPrice / penPrice).toFixed(4));
    if (!Number.isFinite(penToBob) || penToBob <= 0) {
      throw new Error('Binance P2P rate invalido');
    }

    return {
      rate: new Prisma.Decimal(penToBob),
      updatedAt: new Date(),
    };
  }
}
