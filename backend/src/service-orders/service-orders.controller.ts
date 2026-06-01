import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ServiceOrdersService } from './service-orders.service.js';
import { CreateServiceOrderDto } from './dto/create-service-order.dto.js';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto.js';
import { AddOrderPartDto } from './dto/add-order-part.dto.js';
import { AddWorkHourDto } from './dto/add-work-hour.dto.js';
import { AddAdditionalCostDto } from './dto/add-additional-cost.dto.js';
import { AddPaymentDto } from './dto/add-payment.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(private serviceOrdersService: ServiceOrdersService) {}

  // ─── Stats ───────────────────────────────────────────────

  @Get('stats')
  getStats() {
    return this.serviceOrdersService.getStats();
  }

  @Get('billing-report')
  getBillingReport(
    @Query('customerId') customerId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.serviceOrdersService.getBillingReport(
      customerId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  // ─── CRUD Principal ─────────────────────────────────────

  @Post()
  create(
    @Body() dto: CreateServiceOrderDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.serviceOrdersService.create(dto, user.id);
  }

  @Get()
  findAll(
    @Query('status') status?: OrderStatus,
    @Query('customerId') customerId?: string,
    @Query('search') search?: string,
  ) {
    return this.serviceOrdersService.findAll({ status, customerId, search });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serviceOrdersService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateServiceOrderDto) {
    return this.serviceOrdersService.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
  ) {
    return this.serviceOrdersService.updateStatus(id, status);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.serviceOrdersService.remove(id);
  }

  // ─── Resumo financeiro ───────────────────────────────────

  @Get(':id/summary')
  getSummary(@Param('id') id: string) {
    return this.serviceOrdersService.getSummary(id);
  }

  // ─── Peças ───────────────────────────────────────────────

  @Post(':id/parts')
  addPart(@Param('id') id: string, @Body() dto: AddOrderPartDto) {
    return this.serviceOrdersService.addPart(id, dto);
  }

  @Delete(':id/parts/:orderPartId')
  removePart(
    @Param('id') id: string,
    @Param('orderPartId') orderPartId: string,
  ) {
    return this.serviceOrdersService.removePart(id, orderPartId);
  }

  // ─── Horas Trabalhadas ───────────────────────────────────

  @Post(':id/work-hours')
  addWorkHour(
    @Param('id') id: string,
    @Body() dto: AddWorkHourDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.serviceOrdersService.addWorkHour(id, dto, user.id);
  }

  @Delete(':id/work-hours/:workHourId')
  removeWorkHour(
    @Param('id') id: string,
    @Param('workHourId') workHourId: string,
  ) {
    return this.serviceOrdersService.removeWorkHour(id, workHourId);
  }

  // ─── Custos Adicionais ───────────────────────────────────

  @Post(':id/additional-costs')
  addAdditionalCost(
    @Param('id') id: string,
    @Body() dto: AddAdditionalCostDto,
  ) {
    return this.serviceOrdersService.addAdditionalCost(id, dto);
  }

  @Delete(':id/additional-costs/:costId')
  removeAdditionalCost(
    @Param('id') id: string,
    @Param('costId') costId: string,
  ) {
    return this.serviceOrdersService.removeAdditionalCost(id, costId);
  }

  // ─── Pagamentos ──────────────────────────────────────────

  @Post(':id/payments')
  addPayment(@Param('id') id: string, @Body() dto: AddPaymentDto) {
    return this.serviceOrdersService.addPayment(id, dto);
  }

  @Delete(':id/payments/:paymentId')
  removePayment(
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.serviceOrdersService.removePayment(id, paymentId);
  }
}
