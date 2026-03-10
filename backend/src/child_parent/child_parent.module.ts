import { Module } from '@nestjs/common';
import { ChildParentService } from './child_parent.service';
import { ChildParentController } from './child_parent.controller';

@Module({
  providers: [ChildParentService],
  controllers: [ChildParentController]
})
export class ChildParentModule {}
