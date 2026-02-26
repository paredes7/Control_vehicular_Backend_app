import { Body, Controller, Patch, Param, Req } from '@nestjs/common';
import { RequestCorrectionDto } from './dto/request-correction.dto';
import { AdminFiatOperationsService } from './admin-fiat-operations.service';


@Controller('admin/fiat-operations')
export class AdminFiatOperationsController {
    constructor(private readonly service: AdminFiatOperationsService) {}

    @Patch(':id/request-correction')
    async requestCorrection(@Param('id') id: string, @Body() body: RequestCorrectionDto, @Req() req) {
        const adminId = req.user.userid;
        return this.service.requestDepositCorrection(adminId, id, body.note);
    }
}
