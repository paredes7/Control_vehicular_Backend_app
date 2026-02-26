import { Controller, Get, Param } from '@nestjs/common';
import { ExchangeRateService } from './exchange-rate.service';

@Controller('exchange-rate')
export class ExchangeRateController {
  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  @Get()
  findAll() {
    return this.exchangeRateService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.exchangeRateService.findOne(+id);
  }

}
