import { Injectable } from '@nestjs/common';


@Injectable()
export class ExchangeRateService {

  async fetchP2PPrice(fiat: 'PEN' | 'BOB') {
  const response = await fetch(
    'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

async findAll() {
  // llamadas paralelas
  const [pen, bob] = await Promise.all([
    this.fetchP2PPrice('PEN'),
    this.fetchP2PPrice('BOB'),
  ]);

  //  conversiones CORRECTAS
  // 1 PEN = (BOB / PEN)
  const penPorBob = Number(
    (bob.precio_usdt / pen.precio_usdt).toFixed(4),
  );

  // 1 BOB = (PEN / BOB)
  const bobPorPen = Number(
    (pen.precio_usdt / bob.precio_usdt).toFixed(4),
  );

  return {
    fuente: 'Binance P2P',
    timestamp: new Date().toISOString(),

    usdt: {
      PEN: pen,
      BOB: bob,
    },

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

  findOne(id: number) {
    return `This action returns a #${id} exchangeRate`;
  }

}
