import { IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum FiatCurrencyDto {
  BOB = 'BOB',
  PEN = 'PEN',
}

export class CreateDepositDto {
  @IsEnum(FiatCurrencyDto)
  currency: FiatCurrencyDto;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.01)
  amount: number;
}
