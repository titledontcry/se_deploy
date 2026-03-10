import { Test, TestingModule } from '@nestjs/testing';
import { VitalSignsService } from './vital_signs.service';

describe('VitalSignsService', () => {
  let service: VitalSignsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VitalSignsService],
    }).compile();

    service = module.get<VitalSignsService>(VitalSignsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
