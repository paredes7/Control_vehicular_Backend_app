import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerificationController } from './verification.controller';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

@Module({
  controllers: [VerificationController],
  providers: [VerificationService, CloudinaryService, PrismaService],
})
export class VerificationModule { }
