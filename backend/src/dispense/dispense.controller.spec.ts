import { Test, TestingModule } from '@nestjs/testing';
import { DispenseController } from './dispense.controller';

describe('DispenseController', () => {
  let controller: DispenseController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DispenseController],
    }).compile();

    controller = module.get<DispenseController>(DispenseController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
