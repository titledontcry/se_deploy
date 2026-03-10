import { Test, TestingModule } from '@nestjs/testing';
import { WorkSchedulesController } from './work_schedules.controller';

describe('WorkSchedulesController', () => {
  let controller: WorkSchedulesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkSchedulesController],
    }).compile();

    controller = module.get<WorkSchedulesController>(WorkSchedulesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
