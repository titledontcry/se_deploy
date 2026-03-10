import { Module } from '@nestjs/common';
import { AssessmentAnswerService } from './assessment_answer.service';
import { AssessmentAnswerController } from './assessment_answer.controller';

@Module({
  providers: [AssessmentAnswerService],
  controllers: [AssessmentAnswerController]
})
export class AssessmentAnswerModule {}
