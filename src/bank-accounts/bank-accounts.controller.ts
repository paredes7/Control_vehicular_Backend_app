import { Controller, Get, Post, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private bankAccountsService: BankAccountsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createBankAccountDto: CreateBankAccountDto) {
    return this.bankAccountsService.create(createBankAccountDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/:userId')
  findByUserId(@Param('userId') userId: string) {
    return this.bankAccountsService.findByUserId(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bankAccountsService.remove(BigInt(id));
  }
}
