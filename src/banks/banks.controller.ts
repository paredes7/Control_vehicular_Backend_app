import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';
import { BanksService } from './banks.service';

@Controller('banks')
export class BanksController {
  constructor(private readonly banksService: BanksService){}

  @Get()
  findAll() {
    return this.banksService.getbanks();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.banksService.findOne(+id);
  }

}