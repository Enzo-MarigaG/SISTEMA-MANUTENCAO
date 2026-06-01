import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PartsService } from './parts.service.js';
import { PartsController } from './parts.controller.js';

@Module({
  imports: [PrismaModule],
  providers: [PartsService],
  controllers: [PartsController],
  exports: [PartsService],
})
export class PartsModule {}
