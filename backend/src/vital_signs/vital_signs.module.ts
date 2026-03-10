import { Module } from '@nestjs/common';
import { VitalSignsService } from './vital_signs.service';
import { VitalSignsController } from './vital_signs.controller';

@Module({
  providers: [VitalSignsService],
  controllers: [VitalSignsController]
})
export class VitalSignsModule {}
