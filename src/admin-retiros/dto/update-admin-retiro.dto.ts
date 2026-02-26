import { IsEnum, IsOptional } from 'class-validator';
import { FiatOperationStatus as PrismaStatus } from '@prisma/client';

export class UpdateAdminRetiroDto {
  @IsEnum(PrismaStatus)
  status: PrismaStatus;

  @IsOptional()
  payoutTxRef?: string;
}
