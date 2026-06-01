import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ReportsService } from './reports.service.js';
import { ReportsController } from './reports.controller.js';

@Module({
  imports: [PrismaModule],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
