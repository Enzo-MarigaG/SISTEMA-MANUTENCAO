import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
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

/**
 * Converte uma string de data em Date.
 * Datas "somente dia" (YYYY-MM-DD), vindas de inputs <input type="date">, são
 * ancoradas ao meio-dia UTC para que o fuso horário do cliente não exiba o dia
 * anterior. Timestamps completos (ISO com horário) são preservados.
 */
function toDate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00.000Z`)
    : new Date(value);
}

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
        entryDate: toDate(dto.entryDate),
        estimatedDate: toDate(dto.estimatedDate),
        exitDate: toDate(dto.exitDate),
      },
      include: this.listIncludes(),
    });
  }

  async findAll(filters: {
    status?: OrderStatus;
    customerId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, customerId, search, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.ServiceOrderWhereInput = {
      ...(status && { status }),
      ...(customerId && { customerId }),
      ...(search && {
        OR: [
          {
            equipment: { contains: search, mode: Prisma.QueryMode.insensitive },
          },
          {
            problemReported: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            customer: {
              name: { contains: search, mode: Prisma.QueryMode.insensitive },
            },
          },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.serviceOrder.findMany({
        where,
        include: this.listIncludes(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.serviceOrder.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        technician: {
          select: { id: true, name: true, email: true, pixKey: true },
        },
        orderParts: { include: { part: true }, orderBy: { createdAt: 'asc' } },
        workHours: {
          include: { technician: { select: { id: true, name: true } } },
          orderBy: { workedDate: 'asc' },
        },
        additionalCosts: { orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { createdAt: 'desc' } },
        attachments: { orderBy: { createdAt: 'desc' } },
        travelLegs: { orderBy: [{ date: 'asc' }, { departureTime: 'asc' }] },
      },
    });
    if (!order) throw new NotFoundException('Ordem de serviço não encontrada');
    return order;
  }

  async update(id: string, dto: UpdateServiceOrderDto) {
    await this.findOne(id);
    // FINISHED é o status de encerramento — registra a data/hora de saída.
    const isClosing =
      dto.status === OrderStatus.FINISHED ||
      dto.status === OrderStatus.DELIVERED;
    if (isClosing && !dto.exitDate) {
      dto.exitDate = new Date().toISOString();
    }
    return this.prisma.serviceOrder.update({
      where: { id },
      data: {
        ...dto,
        estimatedDate: toDate(dto.estimatedDate),
        exitDate: toDate(dto.exitDate),
      },
      include: this.listIncludes(),
    });
  }

  async updateStatus(id: string, status: OrderStatus) {
    return this.update(id, { status });
  }

  async remove(id: string) {
    const order = await this.findOne(id);

    // Peças/horas/custos/anexos somem via onDelete: Cascade, mas pagamentos não
    // têm cascade no schema — precisam ser removidos manualmente. E as peças
    // vinculadas ao catálogo devem voltar ao estoque, como acontece no removePart.
    return this.prisma.$transaction(async (tx) => {
      for (const op of order.orderParts) {
        if (op.partId) {
          await tx.part.update({
            where: { id: op.partId },
            data: { stockQty: { increment: op.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              partId: op.partId,
              type: 'IN',
              quantity: op.quantity,
              reason: 'Devolvido ao estoque (exclusão da OS)',
            },
          });
        }
      }
      await tx.payment.deleteMany({ where: { serviceOrderId: id } });
      return tx.serviceOrder.delete({ where: { id } });
    });
  }

  // ─── Peças da OS ────────────────────────────────────────

  async addPart(serviceOrderId: string, dto: AddOrderPartDto) {
    await this.findOne(serviceOrderId);
    const totalPrice = dto.quantity * dto.unitPrice;

    if (dto.partId) {
      const part = await this.prisma.part.findUnique({
        where: { id: dto.partId },
      });
      if (!part) throw new NotFoundException('Peça não encontrada no catálogo');
      if (part.stockQty < dto.quantity) {
        throw new BadRequestException(
          `Estoque insuficiente. Disponível: ${part.stockQty}`,
        );
      }

      return this.prisma.$transaction(async (tx) => {
        await tx.part.update({
          where: { id: dto.partId },
          data: { stockQty: { decrement: dto.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            partId: dto.partId!,
            type: 'OUT',
            quantity: dto.quantity,
            reason: 'Usado na OS',
          },
        });
        return tx.orderPart.create({
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
      });
    }

    return this.prisma.orderPart.create({
      data: {
        serviceOrderId,
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
      return this.prisma.$transaction(async (tx) => {
        await tx.part.update({
          where: { id: orderPart.partId! },
          data: { stockQty: { increment: orderPart.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            partId: orderPart.partId!,
            type: 'IN',
            quantity: orderPart.quantity,
            reason: 'Devolvido ao estoque (remoção da OS)',
          },
        });
        return tx.orderPart.delete({ where: { id: orderPartId } });
      });
    }

    return this.prisma.orderPart.delete({ where: { id: orderPartId } });
  }

  async updatePart(
    serviceOrderId: string,
    orderPartId: string,
    dto: UpdateOrderPartDto,
  ) {
    const orderPart = await this.prisma.orderPart.findFirst({
      where: { id: orderPartId, serviceOrderId },
    });
    if (!orderPart) throw new NotFoundException('Peça não encontrada na OS');

    const totalPrice = dto.quantity * dto.unitPrice;

    // Se a peça veio do catálogo, ajusta o estoque pela diferença de quantidade.
    if (orderPart.partId) {
      const delta = dto.quantity - orderPart.quantity; // >0 usa mais / <0 devolve

      return this.prisma.$transaction(async (tx) => {
        if (delta !== 0) {
          if (delta > 0) {
            const part = await tx.part.findUnique({
              where: { id: orderPart.partId! },
            });
            if (part && part.stockQty < delta) {
              throw new BadRequestException(
                `Estoque insuficiente. Disponível: ${part.stockQty}`,
              );
            }
          }
          await tx.part.update({
            where: { id: orderPart.partId! },
            data: { stockQty: { decrement: delta } }, // decrement de nº negativo = soma
          });
          await tx.stockMovement.create({
            data: {
              partId: orderPart.partId!,
              type: delta > 0 ? 'OUT' : 'IN',
              quantity: Math.abs(delta),
              reason: 'Ajuste por edição da OS',
            },
          });
        }
        return tx.orderPart.update({
          where: { id: orderPartId },
          data: {
            partName: dto.partName,
            quantity: dto.quantity,
            unitPrice: dto.unitPrice,
            totalPrice,
          },
          include: { part: true },
        });
      });
    }

    return this.prisma.orderPart.update({
      where: { id: orderPartId },
      data: {
        partName: dto.partName,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        totalPrice,
      },
      include: { part: true },
    });
  }

  // ─── Horas Trabalhadas ───────────────────────────────────

  async addWorkHour(
    serviceOrderId: string,
    dto: AddWorkHourDto,
    userId: string,
  ) {
    await this.findOne(serviceOrderId);
    const totalCost = dto.hours * dto.hourlyRate;

    return this.prisma.workHour.create({
      data: {
        serviceOrderId,
        technicianId: userId,
        hours: dto.hours,
        hourlyRate: dto.hourlyRate,
        totalCost,
        workedDate: toDate(dto.workedDate)!,
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

  async updateWorkHour(
    serviceOrderId: string,
    workHourId: string,
    dto: AddWorkHourDto,
  ) {
    const wh = await this.prisma.workHour.findFirst({
      where: { id: workHourId, serviceOrderId },
    });
    if (!wh) throw new NotFoundException('Registro de horas não encontrado');

    return this.prisma.workHour.update({
      where: { id: workHourId },
      data: {
        hours: dto.hours,
        hourlyRate: dto.hourlyRate,
        totalCost: dto.hours * dto.hourlyRate,
        workedDate: toDate(dto.workedDate)!,
        description: dto.description,
      },
    });
  }

  // ─── Custos Adicionais ───────────────────────────────────

  async addAdditionalCost(serviceOrderId: string, dto: AddAdditionalCostDto) {
    await this.findOne(serviceOrderId);
    return this.prisma.additionalCost.create({
      data: {
        serviceOrderId,
        description: dto.description,
        amount: dto.amount,
      },
    });
  }

  async removeAdditionalCost(serviceOrderId: string, costId: string) {
    const cost = await this.prisma.additionalCost.findFirst({
      where: { id: costId, serviceOrderId },
    });
    if (!cost) throw new NotFoundException('Custo não encontrado');
    return this.prisma.additionalCost.delete({ where: { id: costId } });
  }

  async updateAdditionalCost(
    serviceOrderId: string,
    costId: string,
    dto: AddAdditionalCostDto,
  ) {
    const cost = await this.prisma.additionalCost.findFirst({
      where: { id: costId, serviceOrderId },
    });
    if (!cost) throw new NotFoundException('Custo não encontrado');

    return this.prisma.additionalCost.update({
      where: { id: costId },
      data: { description: dto.description, amount: dto.amount },
    });
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
        paymentDate: toDate(dto.paymentDate) ?? new Date(),
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

  // ─── Assinaturas ─────────────────────────────────────────

  async saveSignatures(id: string, dto: SaveSignaturesDto) {
    await this.findOne(id);

    const data: Prisma.ServiceOrderUpdateInput = {};
    if (dto.signatureTechnician !== undefined)
      data.signatureTechnician = dto.signatureTechnician;
    if (dto.signatureCustomer !== undefined)
      data.signatureCustomer = dto.signatureCustomer;

    // Marca quando houve a última assinatura; zera se ambas forem removidas.
    const order = await this.prisma.serviceOrder.findUnique({
      where: { id },
      select: { signatureTechnician: true, signatureCustomer: true },
    });
    const nextTech =
      dto.signatureTechnician !== undefined
        ? dto.signatureTechnician
        : order?.signatureTechnician;
    const nextCust =
      dto.signatureCustomer !== undefined
        ? dto.signatureCustomer
        : order?.signatureCustomer;
    data.signedAt = nextTech || nextCust ? new Date() : null;

    return this.prisma.serviceOrder.update({
      where: { id },
      data,
      select: {
        id: true,
        signatureTechnician: true,
        signatureCustomer: true,
        signedAt: true,
      },
    });
  }

  // ─── Custos de Viagem ────────────────────────────────────

  /** Ajusta apenas as taxas (R$/km e R$/hora). Os totais vêm dos trechos. */
  async saveTravel(id: string, dto: SaveTravelDto) {
    await this.findOne(id);
    const data: Prisma.ServiceOrderUpdateInput = {};
    if (dto.travelKmRate !== undefined) data.travelKmRate = dto.travelKmRate;
    if (dto.travelHourRate !== undefined)
      data.travelHourRate = dto.travelHourRate;

    return this.prisma.serviceOrder.update({
      where: { id },
      data,
      select: {
        id: true,
        travelKmRate: true,
        travelHourRate: true,
      },
    });
  }

  /** Duração de um trecho, em horas, a partir de "HH:mm" (trata virada de dia). */
  private legDurationHours(departureTime: string, arrivalTime: string): number {
    const [dh, dm] = departureTime.split(':').map(Number);
    const [ah, am] = arrivalTime.split(':').map(Number);
    let mins = ah * 60 + am - (dh * 60 + dm);
    if (mins < 0) mins += 24 * 60; // chegou no dia seguinte
    return mins / 60;
  }

  /** Recalcula travelKm/travelHours da OS a partir dos trechos. */
  private async recomputeTravelTotals(
    tx: Prisma.TransactionClient,
    serviceOrderId: string,
  ) {
    const legs = await tx.travelLeg.findMany({ where: { serviceOrderId } });
    const travelKm = legs.reduce((s, l) => s + l.km, 0);
    const travelHours = legs.reduce(
      (s, l) => s + this.legDurationHours(l.departureTime, l.arrivalTime),
      0,
    );
    await tx.serviceOrder.update({
      where: { id: serviceOrderId },
      data: { travelKm, travelHours },
    });
  }

  async addTravelLeg(id: string, dto: CreateTravelLegDto) {
    await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const leg = await tx.travelLeg.create({
        data: {
          serviceOrderId: id,
          date: toDate(dto.date)!,
          departureTime: dto.departureTime,
          arrivalTime: dto.arrivalTime,
          km: dto.km,
          description: dto.description,
        },
      });
      await this.recomputeTravelTotals(tx, id);
      return leg;
    });
  }

  async updateTravelLeg(id: string, legId: string, dto: UpdateTravelLegDto) {
    await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.travelLeg.findFirst({
        where: { id: legId, serviceOrderId: id },
      });
      if (!existing)
        throw new NotFoundException('Trecho de viagem não encontrado');
      const leg = await tx.travelLeg.update({
        where: { id: legId },
        data: {
          date: toDate(dto.date),
          departureTime: dto.departureTime,
          arrivalTime: dto.arrivalTime,
          km: dto.km,
          description: dto.description ?? null,
        },
      });
      await this.recomputeTravelTotals(tx, id);
      return leg;
    });
  }

  async removeTravelLeg(id: string, legId: string) {
    await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.travelLeg.findFirst({
        where: { id: legId, serviceOrderId: id },
      });
      if (!existing)
        throw new NotFoundException('Trecho de viagem não encontrado');
      await tx.travelLeg.delete({ where: { id: legId } });
      await this.recomputeTravelTotals(tx, id);
      return { success: true };
    });
  }

  // ─── Resumo Financeiro ───────────────────────────────────

  async getSummary(serviceOrderId: string) {
    const [parts, workHours, costs, payments, order] = await Promise.all([
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
      this.prisma.serviceOrder.findUnique({
        where: { id: serviceOrderId },
        select: {
          travelKm: true,
          travelHours: true,
          travelKmRate: true,
          travelHourRate: true,
        },
      }),
    ]);

    const partsTotal = parts._sum.totalPrice ?? 0;
    const hoursTotal = workHours._sum.totalCost ?? 0;
    const costsTotal = costs._sum.amount ?? 0;
    const travelTotal = order
      ? order.travelKm * order.travelKmRate +
        order.travelHours * order.travelHourRate
      : 0;
    const grandTotal = partsTotal + hoursTotal + costsTotal + travelTotal;
    const totalPaid = payments.reduce((s, p) => s + p.amountPaid, 0);

    return {
      partsTotal,
      hoursTotal,
      costsTotal,
      travelTotal,
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

  /**
   * Faturamento de um período = soma do valor total (peças + mão de obra +
   * custos adicionais + viagem) das OS cujo entryDate cai no período.
   * Ao contrário do total pago, sobe a cada OS criada/preenchida no mês.
   */
  private async revenueForPeriod(start: Date, end?: Date) {
    const entryDate = end ? { gte: start, lt: end } : { gte: start };
    const orderFilter = { serviceOrder: { entryDate } };

    const [parts, hours, costs, orders] = await Promise.all([
      this.prisma.orderPart.aggregate({
        where: orderFilter,
        _sum: { totalPrice: true },
      }),
      this.prisma.workHour.aggregate({
        where: orderFilter,
        _sum: { totalCost: true },
      }),
      this.prisma.additionalCost.aggregate({
        where: orderFilter,
        _sum: { amount: true },
      }),
      this.prisma.serviceOrder.findMany({
        where: { entryDate },
        select: {
          travelKm: true,
          travelHours: true,
          travelKmRate: true,
          travelHourRate: true,
        },
      }),
    ]);

    const travel = orders.reduce(
      (s, o) =>
        s + o.travelKm * o.travelKmRate + o.travelHours * o.travelHourRate,
      0,
    );

    return (
      (parts._sum.totalPrice ?? 0) +
      (hours._sum.totalCost ?? 0) +
      (costs._sum.amount ?? 0) +
      travel
    );
  }

  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      total,
      open,
      inProgress,
      finished,
      delivered,
      revenueMonth,
      revenuePrevMonth,
      revenueTotalAgg,
      pendingAgg,
      ordersThisMonth,
      parts,
    ] = await Promise.all([
      this.prisma.serviceOrder.count(),
      this.prisma.serviceOrder.count({ where: { status: 'OPEN' } }),
      this.prisma.serviceOrder.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.serviceOrder.count({ where: { status: 'FINISHED' } }),
      this.prisma.serviceOrder.count({ where: { status: 'DELIVERED' } }),
      this.revenueForPeriod(startOfMonth),
      this.revenueForPeriod(startOfPrevMonth, startOfMonth),
      this.prisma.payment.aggregate({
        _sum: { amountPaid: true },
        where: { paymentStatus: 'PAID' },
      }),
      this.prisma.payment.aggregate({
        _sum: { amountPaid: true },
        where: { paymentStatus: { in: ['PENDING', 'PARTIAL'] } },
      }),
      this.prisma.serviceOrder.count({
        where: { entryDate: { gte: startOfMonth } },
      }),
      this.prisma.part.findMany({ select: { stockQty: true, minStock: true } }),
    ]);

    const revenueChange =
      revenuePrevMonth > 0
        ? Math.round(
            ((revenueMonth - revenuePrevMonth) / revenuePrevMonth) * 100,
          )
        : null;

    const lowStockParts = parts.filter((p) => p.stockQty <= p.minStock).length;

    return {
      total,
      open,
      inProgress,
      finished,
      delivered,
      revenueMonth,
      revenuePrevMonth,
      revenueChange,
      revenueTotal: revenueTotalAgg._sum.amountPaid ?? 0,
      pendingAmount: pendingAgg._sum.amountPaid ?? 0,
      ordersThisMonth,
      lowStockParts,
    };
  }

  // ─── Helpers ────────────────────────────────────────────

  private listIncludes() {
    return {
      customer: { select: { id: true, name: true, phone: true } },
      technician: { select: { id: true, name: true } },
    };
  }
}
