import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminDepositsService } from './admin-deposits.service';
import { ListAdminMintsQueryDto } from './dto/list-admin-mints.dto';

@Controller('admin/mints')
@UseGuards(AuthGuard('jwt'))
export class AdminMintsController {
  constructor(private readonly adminDepositsService: AdminDepositsService) {}

  @Get()
  list(@Req() req: any, @Query() q: ListAdminMintsQueryDto) {
    return this.adminDepositsService.listMints(req.user, q);
  }

  @Get('count-pending')
  countPending(@Req() req: any) {
    return this.adminDepositsService.getPendingMintsCount(req.user);
  }
}
