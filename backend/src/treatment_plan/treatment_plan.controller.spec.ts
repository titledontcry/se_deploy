import { Test, TestingModule } from '@nestjs/testing';
import { TreatmentPlanController } from './treatment_plan.controller';

describe('TreatmentPlanController', () => {
  let controller: TreatmentPlanController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TreatmentPlanController],
    }).compile();

    controller = module.get<TreatmentPlanController>(TreatmentPlanController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
