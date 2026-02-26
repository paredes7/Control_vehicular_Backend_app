import { IsString, IsInt } from 'class-validator';

export class CreateBankAccountDto {
  @IsString()
  userId: string;

  @IsInt()
  bankId: number;

  @IsString()
  accountNumber: string;
}
