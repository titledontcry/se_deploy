import { Module } from '@nestjs/common';
import { WorkSchedulesService } from './work_schedules.service';
import { WorkSchedulesController } from './work_schedules.controller';

@Module({
  providers: [WorkSchedulesService],
  controllers: [WorkSchedulesController]
})
export class WorkSchedulesModule {}
