import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FiatCurrency } from '@prisma/client';

@Injectable()
export class CompanyBankAccountsService {
  constructor(private prisma: PrismaService) {}

  async getByCurrency(currency: FiatCurrency) {
    const acc = await this.prisma.companyBankAccount.findUnique({
      where: { currency },
      select: {
        currency: true,
        bankName: true,
        accountHolder: true,
        accountNumber: true,
        cci: true,
        qrImageUrl: true,
        qrPublicId: true,
      },
    });

    if (!acc) {
      throw new NotFoundException(`No existe cuenta bancaria configurada para ${currency}`);
    }

    return acc;
  }
}