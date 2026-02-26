import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ListenerService } from './listener.service';
import { EventProcessorService } from './processors/event-processor.service';

@Controller('listener')
export class ListenerController {
  constructor(
    private readonly listenerService: ListenerService,
    private processorService: EventProcessorService
  ) {}
  

  @Get('status')
  getStatus(){
    return {
      ...this.listenerService.getStatus(),
      contractPaused: this.processorService.getIsPaused(),
    }
  }

}
