import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentScoreBandService } from './assessment_score_band.service';

describe('AssessmentScoreBandService', () => {
  let service: AssessmentScoreBandService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AssessmentScoreBandService],
    }).compile();

    service = module.get<AssessmentScoreBandService>(AssessmentScoreBandService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
