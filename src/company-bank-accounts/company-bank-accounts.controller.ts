import { Controller, Get, Param, ParseEnumPipe } from '@nestjs/common';
import { CompanyBankAccountsService } from './company-bank-accounts.service';
import { FiatCurrency } from '@prisma/client';

@Controller('company-bank-accounts')
export class CompanyBankAccountsController {
  constructor(private readonly companyBankAccountsService: CompanyBankAccountsService) {}

  @Get(':currency')
  getByCurrency(
    @Param('currency', new ParseEnumPipe(FiatCurrency)) currency: FiatCurrency,
  ) {
    return this.companyBankAccountsService.getByCurrency(currency);
  }
}