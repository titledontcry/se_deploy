import { Test, TestingModule } from '@nestjs/testing';
import { DispenseService } from './dispense.service';

describe('DispenseService', () => {
  let service: DispenseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DispenseService],
    }).compile();

    service = module.get<DispenseService>(DispenseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
