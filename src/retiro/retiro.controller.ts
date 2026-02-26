import { Controller, UseGuards, Post, Body } from '@nestjs/common';
import { RetiroService } from './retiro.service';
import { CreateRetiroDto } from './dto/create-retiro.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { KycVerified } from '../auth/decorators/kyc-verified.decorator';
import { KycVerifiedGuard } from '../auth/guards/kyc-verified.guard';
 
interface JwtUser {
  userId: string;
  email: string;
  isVerified: boolean;
}
 
@Controller('retiro')
export class RetiroController {
  constructor(private retiroService: RetiroService) {}

  @UseGuards(JwtAuthGuard, KycVerifiedGuard)
  @KycVerified()
  @Post()
  create(@Body() dto: CreateRetiroDto, @CurrentUser() user: JwtUser) {

    return this.retiroService.create(dto, String(user.userId));
  }
}
