import { Module } from '@nestjs/common';
import { RetiroService } from './retiro.service';
import { RetiroController } from './retiro.controller';
import { RateService } from '../rate/rate.service';
import { MailService } from 'src/mail/mail.service';

@Module({
  controllers: [RetiroController],
  providers: [RetiroService,RateService,MailService],
})
export class RetiroModule {}
