import { Module } from '@nestjs/common';
import { AssessmentScoreBandService } from './assessment_score_band.service';
import { AssessmentScoreBandController } from './assessment_score_band.controller';

@Module({
  providers: [AssessmentScoreBandService],
  controllers: [AssessmentScoreBandController]
})
export class AssessmentScoreBandModule {}
