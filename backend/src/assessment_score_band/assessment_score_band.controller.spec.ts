import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentScoreBandController } from './assessment_score_band.controller';

describe('AssessmentScoreBandController', () => {
  let controller: AssessmentScoreBandController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssessmentScoreBandController],
    }).compile();

    controller = module.get<AssessmentScoreBandController>(AssessmentScoreBandController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
