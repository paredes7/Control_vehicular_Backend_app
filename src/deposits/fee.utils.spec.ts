import { FiatCurrency, Prisma } from '@prisma/client';
import { calculateDepositFees } from './fee.utils';

describe('calculateDepositFees', () => {
  const d = (value: string | number) => new Prisma.Decimal(value);

  it('rejects deposits below minimum', () => {
    expect(() =>
      calculateDepositFees({
        amount: d('9999'),
        bobEquivalent: d('9999'),
        currency: FiatCurrency.BOB,
        rateUsed: null,
      }),
    ).toThrow('Deposit below minimum');
  });

  it('uses fixed fee at 10,000 BOB', () => {
    const amount = d('10000');
    const result = calculateDepositFees({
      amount,
      bobEquivalent: amount,
      currency: FiatCurrency.BOB,
      rateUsed: null,
    });

    const expectedFeeRate = d('100').div(amount).toDecimalPlaces(6);

    expect(result.feeRate.toString()).toBe(expectedFeeRate.toString());
    expect(result.serviceFee.toString()).toBe('100');
    expect(result.totalAmount.toString()).toBe('10100');
  });

  it('uses fixed fee at 10,001 BOB', () => {
    const amount = d('10001');
    const result = calculateDepositFees({
      amount,
      bobEquivalent: amount,
      currency: FiatCurrency.BOB,
      rateUsed: null,
    });

    const expectedFeeRate = d('100').div(amount).toDecimalPlaces(6);

    expect(result.feeRate.toString()).toBe(expectedFeeRate.toString());
    expect(result.serviceFee.toString()).toBe('100');
    expect(result.totalAmount.toString()).toBe('10101');
  });

  it('uses fixed fee at 99,999 BOB', () => {
    const amount = d('99999');
    const result = calculateDepositFees({
      amount,
      bobEquivalent: amount,
      currency: FiatCurrency.BOB,
      rateUsed: null,
    });

    const expectedFeeRate = d('100').div(amount).toDecimalPlaces(6);

    expect(result.feeRate.toString()).toBe(expectedFeeRate.toString());
    expect(result.serviceFee.toString()).toBe('100');
    expect(result.totalAmount.toString()).toBe('100099');
  });

  it('uses percent fee at 100,000 BOB', () => {
    const amount = d('100000');
    const result = calculateDepositFees({
      amount,
      bobEquivalent: amount,
      currency: FiatCurrency.BOB,
      rateUsed: null,
    });

    expect(result.feeRate.toString()).toBe('0.001');
    expect(result.serviceFee.toString()).toBe('100');
    expect(result.totalAmount.toString()).toBe('100100');
  });

  it('uses percent fee at 150,000 BOB', () => {
    const amount = d('150000');
    const result = calculateDepositFees({
      amount,
      bobEquivalent: amount,
      currency: FiatCurrency.BOB,
      rateUsed: null,
    });

    expect(result.feeRate.toString()).toBe('0.001');
    expect(result.serviceFee.toString()).toBe('150');
    expect(result.totalAmount.toString()).toBe('150150');
  });

  it('converts fixed fee to PEN using rateUsed', () => {
    const amount = d('1000');
    const rateUsed = d('11');
    const bobEquivalent = amount.mul(rateUsed);
    const result = calculateDepositFees({
      amount,
      bobEquivalent,
      currency: FiatCurrency.PEN,
      rateUsed,
    });

    const expectedServiceFee = d('100').div(rateUsed);

    expect(result.serviceFee.toString()).toBe(expectedServiceFee.toString());
    expect(result.totalAmount.toString()).toBe(amount.add(expectedServiceFee).toString());
  });
});
