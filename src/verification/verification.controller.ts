import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, UploadedFile, BadRequestException, ParseUUIDPipe, ParseEnumPipe } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { UpdateVerificationDto } from './dto/update-verification.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { KycStatus, UserRole, VerificationStatus } from '@prisma/client';
import { AcceptRequestDto } from './dto/accept-request.dto';
interface JwtUser {
  userId: string;
  email: string;
  role: UserRole;
  kycStatus: KycStatus;
  isVerified: boolean;
}
@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) { }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 7 * 1024 * 1024 }, // 7MB
    })
  )
  async uploadVerificationFile(@CurrentUser() user: JwtUser, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Archivo no proporcionado');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Tipo de archivo no permitido. Solo se permiten: JPEG, PNG, WebP y PDF');
    }

    const userId = user.userId;
    return this.verificationService.createRequest(userId, file);
  }

  @Get('pending-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getPendingRequests() {
    return this.verificationService.findPendingRequests();
  }

  @Patch("accept")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async acceptRequest(@Body() body: AcceptRequestDto) {
    return this.verificationService.acceptPendingRequest(body.requestId)
  }

  @Patch("reject")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async rejectRequest(@Body() body: AcceptRequestDto) {
    return this.verificationService.rejectPendingRequest(body.requestId);
  }

  @Get("status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  async findStatus(@CurrentUser() user: JwtUser) {
    return this.verificationService.findStatusByUserId(user.userId);
  }

  @Get("all")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.verificationService.findAll();
  }
  @Get('requests/:param')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAllBystatus(@Param('param', new ParseEnumPipe(VerificationStatus)) param: VerificationStatus) {
    return this.verificationService.findRequestsByParam(param);
  }

  @Get("pending-requests/quantity")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getQuantity() {
    return this.verificationService.getQuantity();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.verificationService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateVerificationDto: UpdateVerificationDto) {
    return this.verificationService.update(+id, updateVerificationDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.verificationService.remove(id);
  }
}
