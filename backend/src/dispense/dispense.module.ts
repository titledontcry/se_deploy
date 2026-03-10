import { Module } from '@nestjs/common';
import { DispenseService } from './dispense.service';
import { DispenseController } from './dispense.controller';

@Module({
  providers: [DispenseService],
  controllers: [DispenseController]
})
export class DispenseModule {}
