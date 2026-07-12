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
import { UpdateOrderPartDto } from './dto/update-order-part.dto.js';
import { AddWorkHourDto } from './dto/add-work-hour.dto.js';
import { AddAdditionalCostDto } from './dto/add-additional-cost.dto.js';
import { AddPaymentDto } from './dto/add-payment.dto.js';
import { SaveSignaturesDto } from './dto/save-signatures.dto.js';
import { SaveTravelDto } from './dto/save-travel.dto.js';
import { CreateTravelLegDto } from './dto/create-travel-leg.dto.js';
import { UpdateTravelLegDto } from './dto/update-travel-leg.dto.js';

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
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.serviceOrdersService.findAll({
      status,
      customerId,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
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
  updateStatus(@Param('id') id: string, @Body('status') status: OrderStatus) {
    return this.serviceOrdersService.updateStatus(id, status);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.serviceOrdersService.remove(id);
  }

  // ─── Assinaturas ─────────────────────────────────────────

  @Patch(':id/signatures')
  saveSignatures(@Param('id') id: string, @Body() dto: SaveSignaturesDto) {
    return this.serviceOrdersService.saveSignatures(id, dto);
  }

  // ─── Custos de Viagem ────────────────────────────────────

  @Patch(':id/travel')
  saveTravel(@Param('id') id: string, @Body() dto: SaveTravelDto) {
    return this.serviceOrdersService.saveTravel(id, dto);
  }

  @Post(':id/travel-legs')
  addTravelLeg(@Param('id') id: string, @Body() dto: CreateTravelLegDto) {
    return this.serviceOrdersService.addTravelLeg(id, dto);
  }

  @Patch(':id/travel-legs/:legId')
  updateTravelLeg(
    @Param('id') id: string,
    @Param('legId') legId: string,
    @Body() dto: UpdateTravelLegDto,
  ) {
    return this.serviceOrdersService.updateTravelLeg(id, legId, dto);
  }

  @Delete(':id/travel-legs/:legId')
  removeTravelLeg(@Param('id') id: string, @Param('legId') legId: string) {
    return this.serviceOrdersService.removeTravelLeg(id, legId);
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

  @Patch(':id/parts/:orderPartId')
  updatePart(
    @Param('id') id: string,
    @Param('orderPartId') orderPartId: string,
    @Body() dto: UpdateOrderPartDto,
  ) {
    return this.serviceOrdersService.updatePart(id, orderPartId, dto);
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

  @Patch(':id/work-hours/:workHourId')
  updateWorkHour(
    @Param('id') id: string,
    @Param('workHourId') workHourId: string,
    @Body() dto: AddWorkHourDto,
  ) {
    return this.serviceOrdersService.updateWorkHour(id, workHourId, dto);
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

  @Patch(':id/additional-costs/:costId')
  updateAdditionalCost(
    @Param('id') id: string,
    @Param('costId') costId: string,
    @Body() dto: AddAdditionalCostDto,
  ) {
    return this.serviceOrdersService.updateAdditionalCost(id, costId, dto);
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
