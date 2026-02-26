import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum AdminDepositStatusFilter {
  ALL = 'ALL',
  PENDING = 'PENDING',
  PROOF_SUBMITTED = 'PROOF_SUBMITTED',
  NEED_CORRECTION = 'NEED_CORRECTION',
  RATE_EXPIRED = 'RATE_EXPIRED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  MINTED = 'MINTED',
}

export class ListAdminDepositsQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsEnum(AdminDepositStatusFilter)
  status?: AdminDepositStatusFilter;
}
