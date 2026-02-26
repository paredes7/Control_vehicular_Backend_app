import { FiatCurrency, Prisma } from '@prisma/client';

const FIXED_FEE_BOB = new Prisma.Decimal('100');
const FIXED_FEE_MIN_BOB = new Prisma.Decimal('10000');
const FIXED_FEE_MAX_BOB = new Prisma.Decimal('100000');
const PERCENT_FEE_RATE = new Prisma.Decimal('0.001');

export type DepositFeeResult = {
  feeRate: Prisma.Decimal;
  serviceFee: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
};

export function calculateDepositFees(params: {
  amount: Prisma.Decimal;
  bobEquivalent: Prisma.Decimal;
  currency: FiatCurrency;
  rateUsed: Prisma.Decimal | null;
}): DepositFeeResult {
  const { amount, bobEquivalent, currency, rateUsed } = params;

  if (bobEquivalent.lt(FIXED_FEE_MIN_BOB)) {
    throw new Error('Deposit below minimum');
  }

  let feeRate: Prisma.Decimal;
  let serviceFee: Prisma.Decimal;

  if (bobEquivalent.lt(FIXED_FEE_MAX_BOB)) {
    if (currency === FiatCurrency.PEN) {
      if (!rateUsed) {
        throw new Error('rateUsed is required for PEN fixed fee calculation');
      }
      serviceFee = FIXED_FEE_BOB.div(rateUsed);
    } else {
      serviceFee = FIXED_FEE_BOB;
    }
    feeRate = serviceFee.div(amount).toDecimalPlaces(6);
  } else {
    feeRate = PERCENT_FEE_RATE;
    serviceFee = amount.mul(feeRate);
  }

  const totalAmount = amount.add(serviceFee);

  return { feeRate, serviceFee, totalAmount };
}
