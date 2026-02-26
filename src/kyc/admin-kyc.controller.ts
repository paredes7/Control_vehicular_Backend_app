import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminKycService } from './admin-kyc.service';

interface JwtUser {
  userId: string;
  role: UserRole;
}

@Controller('admin/kyc')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminKycController {
  constructor(private readonly adminKycService: AdminKycService) {}

  @Get()
  async list(
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.adminKycService.list({
      status,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.adminKycService.getOne(id);
  }

  @Patch(':id/approve')
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() body: { note?: string },
  ) {
    if (!user?.userId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    return this.adminKycService.approve(id, user.userId, body?.note ?? null);
  }

  @Patch(':id/request-correction')
  async requestCorrection(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() body: { reviewNote?: string },
  ) {
    if (!user?.userId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    if (!body?.reviewNote || body.reviewNote.trim().length < 3) {
      throw new BadRequestException('reviewNote es requerido');
    }
    return this.adminKycService.requestCorrection(
      id,
      user.userId,
      body.reviewNote.trim(),
    );
  }

  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() body: { reviewNote?: string },
  ) {
    if (!user?.userId) {
      throw new BadRequestException('Usuario no autenticado');
    }
    const note = body?.reviewNote?.trim() || null;
    return this.adminKycService.reject(id, user.userId, note);
  }
}
