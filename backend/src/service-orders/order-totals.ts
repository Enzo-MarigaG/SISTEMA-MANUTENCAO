/**
 * Fórmula única do valor de uma OS.
 *
 * Antes esta conta estava duplicada no resumo financeiro, nos relatórios e no
 * frontend — e as cópias saíram do ar entre si (o faturamento por cliente ficou
 * meses somando sem o deslocamento). Tudo que precisa do valor de uma OS deve
 * usar este módulo.
 */

import { OrderStatus, Prisma } from '@prisma/client';

/** Campos de viagem da OS necessários para o custo de deslocamento. */
export type TravelFields = {
  travelKm: number;
  travelHours: number;
  travelKmRate: number;
  travelHourRate: number;
};

/** Seleção Prisma dos campos de viagem. */
export const TRAVEL_SELECT = {
  travelKm: true,
  travelHours: true,
  travelKmRate: true,
  travelHourRate: true,
} as const;

/** Relações necessárias para compor o valor total de uma OS. */
export const ORDER_TOTALS_INCLUDE = {
  orderParts: true,
  workHours: true,
  additionalCosts: true,
  payments: true,
} as const;

export type OrderWithTotals = TravelFields & {
  orderParts: { totalPrice: number }[];
  workHours: { totalCost: number }[];
  additionalCosts: { amount: number }[];
  payments: { amountPaid: number }[];
};

/**
 * Status que entram no faturamento: a OS conta a partir do momento em que o
 * serviço é concluído. OS abertas e em andamento ficam de fora — o que está
 * lançado nelas ainda não foi faturado.
 */
export const BILLABLE_STATUSES: OrderStatus[] = ['FINISHED', 'DELIVERED'];

/** Filtro Prisma de status faturável, para usar em `where` de ServiceOrder. */
export const BILLABLE_WHERE: Prisma.ServiceOrderWhereInput = {
  status: { in: BILLABLE_STATUSES },
};

/** Custo do deslocamento, separado em quilometragem e horas de viagem. */
export const travelKmTotal = (o: TravelFields) => o.travelKm * o.travelKmRate;
export const travelHourTotal = (o: TravelFields) =>
  o.travelHours * o.travelHourRate;
export const travelTotal = (o: TravelFields) =>
  travelKmTotal(o) + travelHourTotal(o);

export const sumTravel = (orders: TravelFields[]) =>
  orders.reduce((s, o) => s + travelTotal(o), 0);

/**
 * Valor da OS = peças + mão de obra + custos adicionais + deslocamento.
 * `totalPaid` soma os pagamentos lançados na OS.
 */
export function computeOrderTotals(order: OrderWithTotals) {
  const partsTotal = order.orderParts.reduce((s, p) => s + p.totalPrice, 0);
  const hoursTotal = order.workHours.reduce((s, h) => s + h.totalCost, 0);
  const costsTotal = order.additionalCosts.reduce((s, c) => s + c.amount, 0);
  const kmTotal = travelKmTotal(order);
  const hourTotal = travelHourTotal(order);
  const travel = kmTotal + hourTotal;
  const grandTotal = partsTotal + hoursTotal + costsTotal + travel;
  const totalPaid = order.payments.reduce((s, p) => s + p.amountPaid, 0);

  return {
    partsTotal,
    hoursTotal,
    costsTotal,
    travelKmTotal: kmTotal,
    travelHourTotal: hourTotal,
    travelTotal: travel,
    grandTotal,
    totalPaid,
    remaining: grandTotal - totalPaid,
  };
}
