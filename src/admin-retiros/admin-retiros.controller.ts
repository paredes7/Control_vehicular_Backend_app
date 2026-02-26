import { Controller, Get, UseGuards, Body, Patch, Param, Req, UploadedFile, UseInterceptors, Query } from '@nestjs/common';
import { AdminRetirosService } from './admin-retiros.service';
import { UpdateAdminRetiroDto } from './dto/update-admin-retiro.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { KycStatus, UserRole } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';

interface JwtUser {
  userId: string;
  email: string;
  role: UserRole;
  kycStatus: KycStatus;
  isVerified: boolean;
}

@Controller('admin-retiros')
export class AdminRetirosController {
  constructor(private adminRetirosService: AdminRetirosService) { }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  findAll( 
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.adminRetirosService.getAllburns(Number(page), Number(limit));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('count-pending')
  getPendingCount( 
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.adminRetirosService.getPendingCount();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('search')
  findAllBurns(
    @Query('q') query?: string,      // texto de búsqueda
    @Query('userId') userId?: string  // opcional, filtrar por usuario
  ) {
    return this.adminRetirosService.searchBurns(query, userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @UseInterceptors(FileInterceptor('file'))
  async updateRetiro(
    @Param('id') id: string,
    @Body() dto: UpdateAdminRetiroDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser,
  ) {
    return this.adminRetirosService.update(id, dto, user, file);
  }
}
