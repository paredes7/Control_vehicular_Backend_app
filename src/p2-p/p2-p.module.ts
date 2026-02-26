import { Module } from '@nestjs/common';
import { P2PService } from './p2-p.service';
import { P2PController } from './p2-p.controller';

@Module({
  controllers: [P2PController],
  providers: [P2PService],
})
export class P2PModule {}
