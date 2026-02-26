import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { HistorialRetiroService } from './historial-retiro.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {KycVerifiedGuard} from '../auth/guards/kyc-verified.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface JwtUser {
  userId: string;
  email: string;
  isVerified: boolean;
}
 

@Controller('historial-retiro')
export class HistorialRetiroController {
  constructor(private  historialRetiroService: HistorialRetiroService) {}

  @UseGuards(JwtAuthGuard, KycVerifiedGuard)
  @Get()
  findAll(
    @CurrentUser() user: JwtUser,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) { 
    return this.historialRetiroService.getHistorialUser(user,Number(page), Number(limit));
  }
 
}
