import { Module } from '@nestjs/common';
import { ChildAssessmentService } from './child_assessment.service';
import { ChildAssessmentController } from './child_assessment.controller';

@Module({
  providers: [ChildAssessmentService],
  controllers: [ChildAssessmentController]
})
export class ChildAssessmentModule {}
