import { IsString, MinLength, MaxLength } from 'class-validator';

export class RequestCorrectionDto {
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  note: string;
}
