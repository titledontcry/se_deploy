import { Test, TestingModule } from '@nestjs/testing';
import { ChildAssessmentService } from './child_assessment.service';

describe('ChildAssessmentService', () => {
  let service: ChildAssessmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChildAssessmentService],
    }).compile();

    service = module.get<ChildAssessmentService>(ChildAssessmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
