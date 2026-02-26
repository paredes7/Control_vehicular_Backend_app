import { Injectable } from '@nestjs/common';


@Injectable()
export class P2PService {


  findOne(id: number) {
    return `This action returns a #${id} p2P`;
  }

  
   async findAll() {
  const response = await fetch(
    'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        asset: 'USDT',
        fiat: 'PEN',
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
    .filter(item =>
      item.adv &&
      item.advertiser &&
      Number(item.adv.tradableQuantity) > 0
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

  const formatted = ranked.map(item => {
    const price = Number(item.adv.price);
    const tradableQty = Number(item.adv.tradableQuantity);
    const minPen = Number(item.adv.minSingleTransAmount);

    //  máximo REAL como Binance
    const maxPenReal = Math.round(tradableQty * price);

    return {
      proveedor: item.advertiser.nickName,
      precio: price,
      aceptacion_porcentaje: Math.round(
        item.advertiser.monthFinishRate * 100
      ),
      operaciones_mes: item.advertiser.monthOrderCount,

      rango_pen: {
        minimo: minPen,
        maximo: maxPenReal,
        texto: `${minPen} PEN - ${maxPenReal} PEN`,
      },

      liquidez: {
        surplusAmount: Number(item.adv.surplusAmount),
        tradableQuantity: tradableQty,
      },

      bancos: item.adv.tradeMethods.map(m => ({
        nombre: m.tradeMethodName,
      })),
    };
  });

  return {
    success: data.success,
    total: formatted.length,
    data: formatted,
  };
}



}
