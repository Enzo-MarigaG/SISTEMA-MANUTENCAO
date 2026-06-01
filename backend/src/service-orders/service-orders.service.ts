import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateServiceOrderDto } from './dto/create-service-order.dto.js';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto.js';
import { AddOrderPartDto } from './dto/add-order-part.dto.js';
import { AddWorkHourDto } from './dto/add-work-hour.dto.js';
import { AddAdditionalCostDto } from './dto/add-additional-cost.dto.js';
import { AddPaymentDto } from './dto/add-payment.dto.js';

@Injectable()
export class ServiceOrdersService {
  constructor(private prisma: PrismaService) {}

  // ─── CRUD Principal ─────────────────────────────────────

  async create(dto: CreateServiceOrderDto, userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId, active: true },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');

    return this.prisma.serviceOrder.create({
      data: {
        customerId: dto.customerId,
        technicianId: dto.technicianId ?? userId,
        equipment: dto.equipment,
        problemReported: dto.problemReported,
        serviceDone: dto.serviceDone,
        observations: dto.observations,
        status: dto.status,
        entryDate: dto.entryDate ? new Date(dto.entryDate) : undefined,
        estimatedDate: dto.estimatedDate ? new Date(dto.estimatedDate) : undefined,
        exitDate: dto.exitDate ? new Date(dto.exitDate) : undefined,
      },
      include: this.listIncludes(),
    });
  }

  async findAll(filters: {
    status?: OrderStatus;
    customerId?: string;
    search?: string;
  }) {
    const { status, customerId, search } = filters;
    return this.prisma.serviceOrder.findMany({
      where: {
        ...(status && { status }),
        ...(customerId && { customerId }),
        ...(search && {
          OR: [
            { equipment: { contains: search, mode: 'insensitive' } },
            { problemReported: { contains: search, mode: 'insensitive' } },
            { customer: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }),
      },
      include: this.listIncludes(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        technician: { select: { id: true, name: true, email: true, pixKey: true } },
        orderParts: { include: { part: true }, orderBy: { createdAt: 'asc' } },
        workHours: {
          include: { technician: { select: { id: true, name: true } } },
          orderBy: { workedDate: 'asc' },
        },
        additionalCosts: { orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { createdAt: 'desc' } },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) throw new NotFoundException('Ordem de serviço não encontrada');
    return order;
  }

  async update(id: string, dto: UpdateServiceOrderDto) {
    await this.findOne(id);
    if (dto.status === OrderStatus.DELIVERED && !dto.exitDate) {
      dto.exitDate = new Date().toISOString();
    }
    return this.prisma.serviceOrder.update({
      where: { id },
      data: {
        ...dto,
        estimatedDate: dto.estimatedDate ? new Date(dto.estimatedDate) : undefined,
        exitDate: dto.exitDate ? new Date(dto.exitDate) : undefined,
      },
      include: this.listIncludes(),
    });
  }

  async updateStatus(id: string, status: OrderStatus) {
    return this.update(id, { status });
  }

  async remove(id: string) {
    const order = await this.findOne(id);
    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('Não é possível excluir uma OS já entregue');
    }
    return this.prisma.serviceOrder.delete({ where: { id } });
  }

  // ─── Peças da OS ────────────────────────────────────────

  async addPart(serviceOrderId: string, dto: AddOrderPartDto) {
    await this.findOne(serviceOrderId);
    const totalPrice = dto.quantity * dto.unitPrice;

    if (dto.partId) {
      const part = await this.prisma.part.findUnique({ where: { id: dto.partId } });
      if (!part) throw new NotFoundException('Peça não encontrada no catálogo');
      if (part.stockQty < dto.quantity) {
        throw new BadRequestException(
          `Estoque insuficiente. Disponível: ${part.stockQty}`,
        );
      }
      await this.prisma.part.update({
        where: { id: dto.partId },
        data: { stockQty: { decrement: dto.quantity } },
      });
      await this.prisma.stockMovement.create({
        data: {
          partId: dto.partId,
          type: 'OUT',
          quantity: dto.quantity,
          reason: `Usado na OS`,
        },
      });
    }

    return this.prisma.orderPart.create({
      data: {
        serviceOrderId,
        partId: dto.partId,
        partName: dto.partName,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        totalPrice,
      },
      include: { part: true },
    });
  }

  async removePart(serviceOrderId: string, orderPartId: string) {
    const orderPart = await this.prisma.orderPart.findFirst({
      where: { id: orderPartId, serviceOrderId },
    });
    if (!orderPart) throw new NotFoundException('Peça não encontrada na OS');

    if (orderPart.partId) {
      await this.prisma.part.update({
        where: { id: orderPart.partId },
        data: { stockQty: { increment: orderPart.quantity } },
      });
      await this.prisma.stockMovement.create({
        data: {
          partId: orderPart.partId,
          type: 'IN',
          quantity: orderPart.quantity,
          reason: 'Devolvido ao estoque (remoção da OS)',
        },
      });
    }

    return this.prisma.orderPart.delete({ where: { id: orderPartId } });
  }

  // ─── Horas Trabalhadas ───────────────────────────────────

  async addWorkHour(serviceOrderId: string, dto: AddWorkHourDto, userId: string) {
    await this.findOne(serviceOrderId);
    const totalCost = dto.hours * dto.hourlyRate;

    return this.prisma.workHour.create({
      data: {
        serviceOrderId,
        technicianId: userId,
        hours: dto.hours,
        hourlyRate: dto.hourlyRate,
        totalCost,
        workedDate: new Date(dto.workedDate),
        description: dto.description,
      },
    });
  }

  async removeWorkHour(serviceOrderId: string, workHourId: string) {
    const wh = await this.prisma.workHour.findFirst({
      where: { id: workHourId, serviceOrderId },
    });
    if (!wh) throw new NotFoundException('Registro de horas não encontrado');
    return this.prisma.workHour.delete({ where: { id: workHourId } });
  }

  // ─── Custos Adicionais ───────────────────────────────────

  async addAdditionalCost(serviceOrderId: string, dto: AddAdditionalCostDto) {
    await this.findOne(serviceOrderId);
    return this.prisma.additionalCost.create({
      data: { serviceOrderId, description: dto.description, amount: dto.amount },
    });
  }

  async removeAdditionalCost(serviceOrderId: string, costId: string) {
    const cost = await this.prisma.additionalCost.findFirst({
      where: { id: costId, serviceOrderId },
    });
    if (!cost) throw new NotFoundException('Custo não encontrado');
    return this.prisma.additionalCost.delete({ where: { id: costId } });
  }

  // ─── Pagamentos ──────────────────────────────────────────

  async addPayment(serviceOrderId: string, dto: AddPaymentDto) {
    await this.findOne(serviceOrderId);
    return this.prisma.payment.create({
      data: {
        serviceOrderId,
        amountPaid: dto.amountPaid,
        paymentMethod: dto.paymentMethod,
        paymentStatus: dto.paymentStatus,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        notes: dto.notes,
      },
    });
  }

  async removePayment(serviceOrderId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, serviceOrderId },
    });
    if (!payment) throw new NotFoundException('Pagamento não encontrado');
    return this.prisma.payment.delete({ where: { id: paymentId } });
  }

  // ─── Resumo Financeiro ───────────────────────────────────

  async getSummary(serviceOrderId: string) {
    const [parts, workHours, costs, payments] = await Promise.all([
      this.prisma.orderPart.aggregate({
        where: { serviceOrderId },
        _sum: { totalPrice: true },
      }),
      this.prisma.workHour.aggregate({
        where: { serviceOrderId },
        _sum: { totalCost: true, hours: true },
      }),
      this.prisma.additionalCost.aggregate({
        where: { serviceOrderId },
        _sum: { amount: true },
      }),
      this.prisma.payment.findMany({ where: { serviceOrderId } }),
    ]);

    const partsTotal = parts._sum.totalPrice ?? 0;
    const hoursTotal = workHours._sum.totalCost ?? 0;
    const costsTotal = costs._sum.amount ?? 0;
    const grandTotal = partsTotal + hoursTotal + costsTotal;
    const totalPaid = payments.reduce((s, p) => s + p.amountPaid, 0);

    return {
      partsTotal,
      hoursTotal,
      costsTotal,
      grandTotal,
      totalPaid,
      remaining: grandTotal - totalPaid,
    };
  }

  // ─── Relatório de Faturamento por Cliente ────────────────

  async getBillingReport(customerId: string, startDate: Date, endDate: Date) {
    return this.prisma.serviceOrder.findMany({
      where: {
        customerId,
        entryDate: { gte: startDate, lte: endDate },
      },
      include: {
        customer: true,
        orderParts: { orderBy: { createdAt: 'asc' } },
        additionalCosts: { orderBy: { createdAt: 'asc' } },
        workHours: { orderBy: { workedDate: 'asc' } },
        payments: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { entryDate: 'asc' },
    });
  }

  // ─── Stats para Dashboard ────────────────────────────────

  async getStats() {
    const [total, open, inProgress, finished, delivered] = await Promise.all([
      this.prisma.serviceOrder.count(),
      this.prisma.serviceOrder.count({ where: { status: 'OPEN' } }),
      this.prisma.serviceOrder.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.serviceOrder.count({ where: { status: 'FINISHED' } }),
      this.prisma.serviceOrder.count({ where: { status: 'DELIVERED' } }),
    ]);
    return { total, open, inProgress, finished, delivered };
  }

  // ─── Helpers ────────────────────────────────────────────

  private listIncludes() {
    return {
      customer: { select: { id: true, name: true, phone: true } },
      technician: { select: { id: true, name: true } },
    };
  }
}
