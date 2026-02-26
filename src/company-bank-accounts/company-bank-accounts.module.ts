import { Module } from '@nestjs/common';
import { CompanyBankAccountsService } from './company-bank-accounts.service';
import { CompanyBankAccountsController } from './company-bank-accounts.controller';

@Module({
  controllers: [CompanyBankAccountsController],
  providers: [CompanyBankAccountsService],
  exports: [CompanyBankAccountsService],
})
export class CompanyBankAccountsModule {}