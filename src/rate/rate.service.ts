import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class RateService implements OnModuleInit {
  private readonly logger = new Logger(RateService.name);
  private lastRate: any = null;

  constructor(private config: ConfigService) {}

  /* ================= CONFIG ================= */

  private getComisionMinima(): number {
    return Number(this.config.get('COMISION_MINIMA'));
  }

  private getPorcentajeComision(): number {
    return Number(this.config.get('PORCENTAJE'));
  }

  private getRateBobToBobh(): number {
    return Number(this.config.get('BOB_TO_BOBH'));
  }

  private getMontoMinimo(): number {
    return Number(this.config.get('Monto_Minimo'));
  }

  /* ================= INIT ================= */

  async onModuleInit() {
    // primera ejecución inmediata
    await this.actualizarTipoCambio();
  }

  /* ================= BINANCE ================= */

  async fetchP2PPrice(fiat: 'PEN' | 'BOB') {
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

    const data = await response.json();

    const ranked = (data.data || [])
      .filter(
        item =>
          item.adv &&
          item.advertiser &&
          Number(item.adv.tradableQuantity) > 0,
      )
      .sort((a, b) => {
        if (b.advertiser.monthFinishRate !== a.advertiser.monthFinishRate) {
          return b.advertiser.monthFinishRate - a.advertiser.monthFinishRate;
        }
        if (b.advertiser.monthOrderCount !== a.advertiser.monthOrderCount) {
          return b.advertiser.monthOrderCount - a.advertiser.monthOrderCount;
        }
        return parseFloat(a.adv.price) - parseFloat(b.adv.price);
      });

    const top = ranked[0];

    return {
      fiat,
      precio_usdt: Number(top.adv.price),
      proveedor: top.advertiser.nickName,
      aceptacion: Math.round(top.advertiser.monthFinishRate * 100),
    };
  }

  async GetBOBtoPen() {
    const [pen, bob] = await Promise.all([
      this.fetchP2PPrice('PEN'),
      this.fetchP2PPrice('BOB'),
    ]);

    const penPorBob = Number((bob.precio_usdt / pen.precio_usdt).toFixed(4));
    const bobPorPen = Number((pen.precio_usdt / bob.precio_usdt).toFixed(4));

    return {
      fuente: 'Binance P2P',
      timestamp: new Date().toISOString(),
      usdt: { PEN: pen, BOB: bob },
      conversion: {
        PEN_BOB: {
          valor: penPorBob,
          texto: `1 PEN = ${penPorBob} BOB`,
        },
        BOB_PEN: {
          valor: bobPorPen,
          texto: `1 BOB = ${bobPorPen} PEN`,
        },
      },
    };
  }

  /* ================= SCHEDULE ================= */

  @Interval(5000)
  async actualizarTipoCambio() {
    try {
      this.lastRate = await this.GetBOBtoPen();
      this.logger.log('Tipo de cambio actualizado');
    } catch (error) {
      this.logger.error('Error actualizando tipo de cambio', error);
    }
  }

  /* ================= GETTERS ================= */

  GetTipoCambioActual() {
    return this.lastRate;
  }

  GetCom() {
    return this.getComisionMinima();
  }

  GetPor() {
    return this.getPorcentajeComision();
  }

  GetBobtoBobh() {
    return this.getRateBobToBobh();
  }

  GetMinMonto() {
    return this.getMontoMinimo();
  }
}
