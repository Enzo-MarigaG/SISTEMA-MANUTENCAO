import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ReportsService } from './reports.service.js';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('dashboard')
  getDashboard() {
    return this.reportsService.getDashboard();
  }

  @Get('monthly-revenue')
  getMonthlyRevenue(@Query('year') year?: string) {
    return this.reportsService.getMonthlyRevenue(
      year ? parseInt(year) : new Date().getFullYear(),
    );
  }

  @Get('orders-by-status')
  getOrdersByStatus() {
    return this.reportsService.getOrdersByStatus();
  }

  @Get('top-customers')
  getTopCustomers(@Query('limit') limit?: string) {
    return this.reportsService.getTopCustomers(limit ? parseInt(limit) : 10);
  }

  @Get('financial-summary')
  getFinancialSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getFinancialSummary(startDate, endDate);
  }
}
