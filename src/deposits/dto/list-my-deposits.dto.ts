import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListMyDepositsQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string; // depositId del último item recibido

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number; // default 10
}
