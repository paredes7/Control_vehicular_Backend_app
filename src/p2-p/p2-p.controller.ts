import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { P2PService } from './p2-p.service';


@Controller('p2-p') 
export class P2PController {
  constructor(private readonly p2PService: P2PService) {}

  @Get()
  findAll() {
    return this.p2PService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.p2PService.findOne(+id);
  }
}
