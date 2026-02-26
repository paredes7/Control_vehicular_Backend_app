// dto/create-retiro.dto.ts
import { IsDecimal, IsOptional, IsString, IsDateString, IsEnum, IsInt } from 'class-validator';
import { FiatCurrency } from '@prisma/client';

export class CreateRetiroDto {
  // ---- FIAT OPERATION ----
  @IsEnum(FiatCurrency)
  currency: FiatCurrency;

  @IsDecimal({ decimal_digits: '0,18' })
  amount: string;


  @IsString()
  txHash: string;

  @IsOptional()
  @IsDateString()
  rateQuotedAt?: string;

  @IsOptional()
  @IsDateString()
  rateExpiresAt?: string;


  // ---- WITHDRAWAL DETAIL ----

  @IsInt()
  bankAccountId: number;
}
