import { Module } from '@nestjs/common';
import { DepositsController } from './deposits.controller';
import { DepositsService } from './deposits.service';
import { PrismaModule } from '../prisma.module';
import { RatesModule } from '../rates/rates.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [PrismaModule, RatesModule, CloudinaryModule],
  controllers: [DepositsController],
  providers: [DepositsService],
})
export class DepositsModule {}
