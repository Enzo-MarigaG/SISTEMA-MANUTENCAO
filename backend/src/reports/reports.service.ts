import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private async revenueInPeriod(gte: Date, lte?: Date) {
    const dateFilter = { gte, ...(lte ? { lte } : {}) };
    const orderWhere = { serviceOrder: { createdAt: dateFilter } };

    const [parts, hours, costs] = await Promise.all([
      this.prisma.orderPart.aggregate({ where: orderWhere, _sum: { totalPrice: true } }),
      this.prisma.workHour.aggregate({ where: orderWhere, _sum: { totalCost: true } }),
      this.prisma.additionalCost.aggregate({ where: orderWhere, _sum: { amount: true } }),
    ]);

    return (
      (parts._sum.totalPrice ?? 0) +
      (hours._sum.totalCost ?? 0) +
      (costs._sum.amount ?? 0)
    );
  }

  async getDashboard() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

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
        where: { createdAt: { gte: startOfMonth } },
        select: { customerId: true },
      }),
    ]);

    const customersThisMonth = new Set(thisMonthOrders.map((o) => o.customerId)).size;

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

    const orderWhere = { serviceOrder: { createdAt: { gte: startOfYear, lt: endOfYear } } };

    const [parts, hours, costs, ordersInYear] = await Promise.all([
      this.prisma.orderPart.findMany({
        where: orderWhere,
        select: { totalPrice: true, serviceOrder: { select: { createdAt: true } } },
      }),
      this.prisma.workHour.findMany({
        where: orderWhere,
        select: { totalCost: true, serviceOrder: { select: { createdAt: true } } },
      }),
      this.prisma.additionalCost.findMany({
        where: orderWhere,
        select: { amount: true, serviceOrder: { select: { createdAt: true } } },
      }),
      this.prisma.serviceOrder.findMany({
        where: { createdAt: { gte: startOfYear, lt: endOfYear } },
        select: { customerId: true, createdAt: true },
      }),
    ]);

    // Clientes únicos por mês
    const monthlyCustomers = Array.from({ length: 12 }, () => new Set<string>());
    for (const o of ordersInYear) {
      monthlyCustomers[new Date(o.createdAt).getMonth()].add(o.customerId);
    }

    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: new Date(year, i).toLocaleDateString('pt-BR', { month: 'short' }),
      revenue: 0,
      customersCount: 0,
    }));

    for (const p of parts) {
      monthly[new Date(p.serviceOrder.createdAt).getMonth()].revenue += p.totalPrice;
    }
    for (const h of hours) {
      monthly[new Date(h.serviceOrder.createdAt).getMonth()].revenue += h.totalCost;
    }
    for (const c of costs) {
      monthly[new Date(c.serviceOrder.createdAt).getMonth()].revenue += c.amount;
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

    const orderWhere = Object.keys(dateFilter).length
      ? { serviceOrder: { createdAt: dateFilter } }
      : {};

    const [parts, hours, costs, pendingPayments, ordersInPeriod] = await Promise.all([
      this.prisma.orderPart.aggregate({ where: orderWhere, _sum: { totalPrice: true } }),
      this.prisma.workHour.aggregate({ where: orderWhere, _sum: { totalCost: true } }),
      this.prisma.additionalCost.aggregate({ where: orderWhere, _sum: { amount: true } }),
      this.prisma.payment.aggregate({
        where: { paymentStatus: 'PENDING' },
        _sum: { amountPaid: true },
      }),
      this.prisma.serviceOrder.count({
        where: Object.keys(dateFilter).length ? { createdAt: dateFilter } : undefined,
      }),
    ]);

    const totalRevenue =
      (parts._sum.totalPrice ?? 0) +
      (hours._sum.totalCost ?? 0) +
      (costs._sum.amount ?? 0);

    return {
      totalRevenue,
      pendingRevenue: pendingPayments._sum.amountPaid ?? 0,
      ordersInPeriod,
    };
  }
}
