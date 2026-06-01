import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ServiceOrdersService } from './service-orders.service.js';
import { ServiceOrdersController } from './service-orders.controller.js';

@Module({
  imports: [PrismaModule],
  providers: [ServiceOrdersService],
  controllers: [ServiceOrdersController],
  exports: [ServiceOrdersService],
})
export class ServiceOrdersModule {}
