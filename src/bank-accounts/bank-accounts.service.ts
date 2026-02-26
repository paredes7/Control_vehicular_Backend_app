import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { PrismaService } from '../prisma.service';
 
@Injectable()
export class BankAccountsService {
  constructor(private prisma: PrismaService) { }

  async create(dto: CreateBankAccountDto) {
    const exists = await this.prisma.bankAccount.findFirst({
      where: {
        userId: dto.userId,
        bankId: dto.bankId,
        accountNumber: dto.accountNumber,
      },
    });

    if (exists) {
      throw new BadRequestException('La cuenta bancaria ya existe');
    }

    const account = await this.prisma.bankAccount.create({
      data: {
        userId: dto.userId,
        bankId: dto.bankId,
        accountNumber: dto.accountNumber,
      },
    });

    return {
      ...account,
      id: account.id.toString(),
      bankId: Number(account.bankId),
    };
  }

  async findByUserId(userId: string) {
    const accounts = await this.prisma.bankAccount.findMany({
      where: { userId },
      include: { bank: true },
    });

    if (accounts.length === 0) {
      throw new NotFoundException('El usuario no tiene cuentas bancarias');
    }

    return accounts.map(account => ({
      ...account,
      id: account.id.toString(),
      bankId: Number(account.bankId),
    }));
  }

  async remove(id: bigint) {
    try {
      const account = await this.prisma.bankAccount.delete({
        where: { id },
      });

      return {
        ...account,
        id: account.id.toString(),
        bankId: Number(account.bankId),
      };
    } catch (error: any) {
      if (error?.code === 'P2025') {
        throw new NotFoundException('La cuenta bancaria no existe');
      }
      if (error?.code === 'P2003') {
        throw new NotFoundException('La cuenta bancaria no puede ser eliminada porque está asociada a transacciones');
      }
      throw error;
    }
  }

}
