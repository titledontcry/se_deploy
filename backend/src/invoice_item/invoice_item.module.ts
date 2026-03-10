import { Module } from '@nestjs/common';
import { InvoiceItemService } from './invoice_item.service';
import { InvoiceItemController } from './invoice_item.controller';

@Module({
  providers: [InvoiceItemService],
  controllers: [InvoiceItemController]
})
export class InvoiceItemModule {}
