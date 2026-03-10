import { Module } from '@nestjs/common';
import { TreatmentPlanService } from './treatment_plan.service';
import { TreatmentPlanController } from './treatment_plan.controller';

@Module({
  providers: [TreatmentPlanService],
  controllers: [TreatmentPlanController]
})
export class TreatmentPlanModule {}
