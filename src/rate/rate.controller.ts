import { Controller, Get,UseGuards } from '@nestjs/common';
import { RateService } from './rate.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('rate')
export class RateController {
  constructor(private readonly rateService: RateService) {}

  @UseGuards(JwtAuthGuard)
  @Get('comision')
  GetComision() {
    return this.rateService.GetCom();
  }
 
  @UseGuards(JwtAuthGuard)
  @Get('porcentaje')
  GetPorcentaje() {
    return this.rateService.GetPor();
  }

  @UseGuards(JwtAuthGuard)
  @Get('bobtopen')
  GetBOB_TO_PEN_RATE() {
    return this.rateService.GetBOBtoPen();
  }

  @UseGuards(JwtAuthGuard)
  @Get('bobtobobh')
  GetBOB_TO_BOBH() {
    return this.rateService.GetBobtoBobh();
  }

  @UseGuards(JwtAuthGuard)
  @Get('minim_amount')
  GetMinAmount() {
    return this.rateService.GetMinMonto();
  }


}
