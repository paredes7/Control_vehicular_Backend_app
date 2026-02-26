import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DepositsService } from './deposits.service';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { ListMyDepositsQueryDto } from './dto/list-my-deposits.dto';
import { KycVerified } from '../auth/decorators/kyc-verified.decorator';
import { KycVerifiedGuard } from '../auth/guards/kyc-verified.guard';

@Controller('deposits')
export class DepositsController {
  constructor(private readonly depositsService: DepositsService) {}

  @UseGuards(AuthGuard('jwt'), KycVerifiedGuard)
  @KycVerified()
  @Post()
  async create(@Req() req: any, @Body() dto: CreateDepositDto) {
    const userId = req.user?.userId;
    return this.depositsService.createDeposit(userId, dto);
  }

  // historial del usuario con cursor pagination
  @UseGuards(AuthGuard('jwt'))
  @Get('my')
  async myDeposits(@Req() req: any, @Query() q: ListMyDepositsQueryDto) {
    const userId = req.user?.userId;
    return this.depositsService.listMyDeposits(userId, q);
  }

  @UseGuards(AuthGuard('jwt'), KycVerifiedGuard)
  @KycVerified()
  @Post(':id/proof')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 7 * 1024 * 1024 }, // 7MB
      fileFilter: (req, file, cb) => {
        const ok = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'application/pdf',
        ].includes(file.mimetype);
        cb(ok ? null : new Error('Tipo de archivo no permitido'), ok);
      },
    })
  )
  async uploadProof(
    @Req() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    const userId = req.user?.userId;
    return this.depositsService.uploadProof(userId, id, file);
  }
}
