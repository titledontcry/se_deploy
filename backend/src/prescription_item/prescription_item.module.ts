import { Module } from '@nestjs/common';
import { PrescriptionItemService } from './prescription_item.service';
import { PrescriptionItemController } from './prescription_item.controller';

@Module({
  providers: [PrescriptionItemService],
  controllers: [PrescriptionItemController]
})
export class PrescriptionItemModule {}
