import { Test, TestingModule } from '@nestjs/testing';
import { ChildParentController } from './child_parent.controller';

describe('ChildParentController', () => {
  let controller: ChildParentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChildParentController],
    }).compile();

    controller = module.get<ChildParentController>(ChildParentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
