import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BILLABLE_STATUSES,
  BILLABLE_WHERE,
  TRAVEL_SELECT,
  sumTravel,
  travelTotal,
} from '../service-orders/order-totals.js';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Faturamento do período. Usa `entryDate` (data do serviço, a mesma da fatura
   * enviada ao cliente) e não `createdAt` (data de digitação), para que estes
   * números fechem com o faturamento por cliente e com o card do Dashboard.
   */
  private async revenueInPeriod(gte: Date, lte?: Date) {
    const entryDate = { gte, ...(lte ? { lte } : {}) };
    const orderWhere = { entryDate, ...BILLABLE_WHERE };

    const [parts, hours, costs, orders] = await Promise.all([
      this.prisma.orderPart.aggregate({
        where: { serviceOrder: orderWhere },
        _sum: { totalPrice: true },
      }),
      this.prisma.workHour.aggregate({
        where: { serviceOrder: orderWhere },
        _sum: { totalCost: true },
      }),
      this.prisma.additionalCost.aggregate({
        where: { serviceOrder: orderWhere },
        _sum: { amount: true },
      }),
      this.prisma.serviceOrder.findMany({
        where: orderWhere,
        select: TRAVEL_SELECT,
      }),
    ]);

    return (
      (parts._sum.totalPrice ?? 0) +
      (hours._sum.totalCost ?? 0) +
      (costs._sum.amount ?? 0) +
      sumTravel(orders)
    );
  }

  async getDashboard() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
    );

    const [
      totalOrders,
      openOrders,
      inProgressOrders,
      finishedOrders,
      deliveredOrders,
      thisMonthRevenue,
      lastMonthRevenue,
      totalCustomers,
      thisMonthOrders,
    ] = await Promise.all([
      this.prisma.serviceOrder.count(),
      this.prisma.serviceOrder.count({ where: { status: 'OPEN' } }),
      this.prisma.serviceOrder.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.serviceOrder.count({ where: { status: 'FINISHED' } }),
      this.prisma.serviceOrder.count({ where: { status: 'DELIVERED' } }),
      this.revenueInPeriod(startOfMonth),
      this.revenueInPeriod(startOfLastMonth, endOfLastMonth),
      this.prisma.customer.count({ where: { active: true } }),
      this.prisma.serviceOrder.findMany({
        where: { entryDate: { gte: startOfMonth } },
        select: { customerId: true },
      }),
    ]);

    const customersThisMonth = new Set(thisMonthOrders.map((o) => o.customerId))
      .size;

    return {
      orders: {
        total: totalOrders,
        open: openOrders,
        inProgress: inProgressOrders,
        finished: finishedOrders,
        delivered: deliveredOrders,
      },
      revenue: {
        thisMonth: thisMonthRevenue,
        lastMonth: lastMonthRevenue,
      },
      totalCustomers,
      customersThisMonth,
    };
  }

  async getMonthlyRevenue(year: number) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);

    const entryDate = { gte: startOfYear, lt: endOfYear };
    // Faturamento conta só OS faturáveis; a contagem de clientes atendidos
    // considera todas as OS do mês.
    const orderWhere = { serviceOrder: { entryDate, ...BILLABLE_WHERE } };
    const month = (d: Date | string) => new Date(d).getMonth();

    const [parts, hours, costs, ordersInYear] = await Promise.all([
      this.prisma.orderPart.findMany({
        where: orderWhere,
        select: {
          totalPrice: true,
          serviceOrder: { select: { entryDate: true } },
        },
      }),
      this.prisma.workHour.findMany({
        where: orderWhere,
        select: {
          totalCost: true,
          serviceOrder: { select: { entryDate: true } },
        },
      }),
      this.prisma.additionalCost.findMany({
        where: orderWhere,
        select: { amount: true, serviceOrder: { select: { entryDate: true } } },
      }),
      this.prisma.serviceOrder.findMany({
        where: { entryDate },
        select: {
          customerId: true,
          entryDate: true,
          status: true,
          ...TRAVEL_SELECT,
        },
      }),
    ]);

    // Clientes únicos por mês
    const monthlyCustomers = Array.from(
      { length: 12 },
      () => new Set<string>(),
    );
    for (const o of ordersInYear) {
      monthlyCustomers[month(o.entryDate)].add(o.customerId);
    }

    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: new Date(year, i).toLocaleDateString('pt-BR', { month: 'short' }),
      revenue: 0,
      customersCount: 0,
    }));

    for (const p of parts) {
      monthly[month(p.serviceOrder.entryDate)].revenue += p.totalPrice;
    }
    for (const h of hours) {
      monthly[month(h.serviceOrder.entryDate)].revenue += h.totalCost;
    }
    for (const c of costs) {
      monthly[month(c.serviceOrder.entryDate)].revenue += c.amount;
    }
    for (const o of ordersInYear) {
      if (BILLABLE_STATUSES.includes(o.status)) {
        monthly[month(o.entryDate)].revenue += travelTotal(o);
      }
    }
    for (let i = 0; i < 12; i++) {
      monthly[i].customersCount = monthlyCustomers[i].size;
    }

    return monthly;
  }

  async getOrdersByStatus() {
    const grouped = await this.prisma.serviceOrder.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const labels: Record<string, string> = {
      OPEN: 'Aberta',
      IN_PROGRESS: 'Em Andamento',
      FINISHED: 'Finalizada',
      DELIVERED: 'Entregue',
    };

    return grouped.map((g) => ({
      status: g.status,
      label: labels[g.status] ?? g.status,
      count: g._count._all,
    }));
  }

  async getTopCustomers(limit = 10) {
    const grouped = await this.prisma.serviceOrder.groupBy({
      by: ['customerId'],
      _count: { _all: true },
      orderBy: { _count: { customerId: 'desc' } },
      take: limit,
    });

    const customerIds = grouped.map((g) => g.customerId);
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true },
    });

    return grouped.map((g) => ({
      customerId: g.customerId,
      name: customers.find((c) => c.id === g.customerId)?.name ?? '—',
      count: g._count._all,
    }));
  }

  async getFinancialSummary(startDate?: string, endDate?: string) {
    const dateFilter = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };

    const orderWhere = {
      ...(Object.keys(dateFilter).length ? { entryDate: dateFilter } : {}),
      ...BILLABLE_WHERE,
    };

    const [parts, hours, costs, pendingPayments, ordersInPeriod] =
      await Promise.all([
        this.prisma.orderPart.aggregate({
          where: { serviceOrder: orderWhere },
          _sum: { totalPrice: true },
        }),
        this.prisma.workHour.aggregate({
          where: { serviceOrder: orderWhere },
          _sum: { totalCost: true },
        }),
        this.prisma.additionalCost.aggregate({
          where: { serviceOrder: orderWhere },
          _sum: { amount: true },
        }),
        this.prisma.payment.aggregate({
          where: { paymentStatus: 'PENDING' },
          _sum: { amountPaid: true },
        }),
        this.prisma.serviceOrder.findMany({
          where: orderWhere,
          select: TRAVEL_SELECT,
        }),
      ]);

    const totalRevenue =
      (parts._sum.totalPrice ?? 0) +
      (hours._sum.totalCost ?? 0) +
      (costs._sum.amount ?? 0) +
      sumTravel(ordersInPeriod);

    return {
      totalRevenue,
      pendingRevenue: pendingPayments._sum.amountPaid ?? 0,
      ordersInPeriod: ordersInPeriod.length,
    };
  }
}
