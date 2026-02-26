import { Module } from '@nestjs/common';
import { KycController } from './kyc.controller';
import { AdminKycController } from './admin-kyc.controller';
import { KycService } from './kyc.service';
import { AdminKycService } from './admin-kyc.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [CloudinaryModule, PrismaModule],
  controllers: [KycController, AdminKycController],
  providers: [KycService, AdminKycService],
})
export class KycModule {}
