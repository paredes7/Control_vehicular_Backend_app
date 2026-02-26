import { PartialType } from '@nestjs/swagger';
import { CreateListenerDto } from './create-listener.dto';

export class UpdateListenerDto extends PartialType(CreateListenerDto) {}
