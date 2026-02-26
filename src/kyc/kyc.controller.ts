import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { KycService } from './kyc.service';

interface JwtUser {
  userId: string;
}

@Controller('kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('request')
  async createRequest(@CurrentUser() user: JwtUser) {
    if (!user?.userId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.kycService.getOrCreateRequest(user.userId);
  }

  @Post('request/:id/upload/:type')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB (max video)
    }),
  )
  async uploadDocument(
    @CurrentUser() user: JwtUser,
    @Param('id') requestId: string,
    @Param('type') type: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!user?.userId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    console.log('[KYC upload]', {
      type,
      fileNull: !file,
      mimetype: file?.mimetype,
      originalname: file?.originalname,
      size: file?.size,
    });
    return this.kycService.uploadDocument(user.userId, requestId, type, file);
  }

  @Post('request/:id/submit')
  async submitRequest(@CurrentUser() user: JwtUser, @Param('id') requestId: string) {
    if (!user?.userId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.kycService.submitRequest(user.userId, requestId);
  }

  @Get('me')
  async me(@CurrentUser() user: JwtUser) {
    if (!user?.userId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.kycService.getMyStatus(user.userId);
  }
}
