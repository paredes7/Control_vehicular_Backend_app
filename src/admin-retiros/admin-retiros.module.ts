import { Module } from '@nestjs/common';
import { AdminRetirosService } from './admin-retiros.service';
import { AdminRetirosController } from './admin-retiros.controller';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { SafeService } from 'src/safe/safe.service';
import { MailService } from 'src/mail/mail.service';
@Module({
  controllers: [AdminRetirosController],
  providers: [AdminRetirosService,CloudinaryService,SafeService,MailService],
})
export class AdminRetirosModule {}
