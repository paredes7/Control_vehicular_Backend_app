import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminDepositsService } from './admin-deposits.service';
import { ListAdminDepositsQueryDto } from './dto/list-admin-deposits.dto';
import { AdminDecisionDto } from './dto/decision.dto';
import { RequestCorrectionDto } from './dto/request-correction.dto';

@Controller('admin/deposits')
@UseGuards(AuthGuard('jwt'))
export class AdminDepositsController {
  constructor(private readonly adminDepositsService: AdminDepositsService) {}

  @Get()
  list(@Req() req: any, @Query() q: ListAdminDepositsQueryDto) {
    return this.adminDepositsService.list(req.user, q);
  }

  @Get(':id')
  getOne(@Req() req: any, @Param('id') id: string) {
    return this.adminDepositsService.getOne(req.user, id);
  }

  @Patch(':id/decision')
  decide(@Req() req: any, @Param('id') id: string, @Body() dto: AdminDecisionDto) {
    return this.adminDepositsService.decide(req.user, id, dto);
  }

  @Patch(':id/request-correction')
  requestCorrection(@Req() req: any, @Param('id') id: string, @Body() dto: RequestCorrectionDto) {
    return this.adminDepositsService.requestCorrection(req.user, id, dto);
  }

  @Post(':id/propose-mint')
  proposeMint(@Req() req: any, @Param('id') id: string) {
    return this.adminDepositsService.proposeMint(req.user, id);
  }
}
