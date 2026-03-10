import { Module } from '@nestjs/common';
import { DiagnoseService } from './diagnose.service';
import { DiagnoseController } from './diagnose.controller';

@Module({
  providers: [DiagnoseService],
  controllers: [DiagnoseController]
})
export class DiagnoseModule {}
