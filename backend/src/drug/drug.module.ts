import { Module } from '@nestjs/common';
import { DrugService } from './drug.service';
import { DrugController } from './drug.controller';

@Module({
  providers: [DrugService],
  controllers: [DrugController]
})
export class DrugModule {}
