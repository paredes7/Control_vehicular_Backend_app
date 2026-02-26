import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class BanksService {
  constructor(private prisma: PrismaService) {}

  async getbanks() {
    try {
      return await this.prisma.banks.findMany();
    } catch (error) {
      throw error;
    }
  }
  
  async findOne(id: number) {
    const bank = await this.prisma.banks.findUnique({
      where: { id },
    });
    if (!bank) {
      throw new NotFoundException(`Bank with id ${id} not found`);
    }
    return bank;

  }
}
