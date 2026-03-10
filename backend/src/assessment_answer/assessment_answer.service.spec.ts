import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentAnswerService } from './assessment_answer.service';

describe('AssessmentAnswerService', () => {
  let service: AssessmentAnswerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AssessmentAnswerService],
    }).compile();

    service = module.get<AssessmentAnswerService>(AssessmentAnswerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
