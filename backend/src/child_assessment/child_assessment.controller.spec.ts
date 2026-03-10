import { Test, TestingModule } from '@nestjs/testing';
import { ChildAssessmentController } from './child_assessment.controller';

describe('ChildAssessmentController', () => {
  let controller: ChildAssessmentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChildAssessmentController],
    }).compile();

    controller = module.get<ChildAssessmentController>(ChildAssessmentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
