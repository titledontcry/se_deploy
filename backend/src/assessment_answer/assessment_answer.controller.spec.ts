import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentAnswerController } from './assessment_answer.controller';

describe('AssessmentAnswerController', () => {
  let controller: AssessmentAnswerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssessmentAnswerController],
    }).compile();

    controller = module.get<AssessmentAnswerController>(AssessmentAnswerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
