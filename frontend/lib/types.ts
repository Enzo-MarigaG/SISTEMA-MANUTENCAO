/**
 * Formato das respostas da API, compartilhado entre a tela da OS, o PDF da OS e
 * o relatório de faturamento — as três precisam dos mesmos campos e antes cada
 * uma lidava com `any`.
 */

export type OrderStatus = 'OPEN' | 'IN_PROGRESS' | 'FINISHED' | 'DELIVERED';
export type PaymentMethod =
  | 'CASH' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'TRANSFER' | 'OTHER';
export type PaymentStatus = 'PAID' | 'PENDING' | 'PARTIAL';

export interface TravelLeg {
  id: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
  km: number;
  description?: string;
}

export interface OrderPart {
  id: string;
  partName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  part?: { sku?: string };
}

export interface WorkHour {
  id: string;
  hours: number;
  hourlyRate: number;
  totalCost: number;
  workedDate: string;
  description?: string;
}

export interface AdditionalCost {
  id: string;
  description: string;
  amount: number;
}

export interface Payment {
  id: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentDate?: string;
  notes?: string;
}

export interface ServiceOrder {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  equipment?: string;
  problemReported: string;
  serviceDone?: string;
  observations?: string;
  entryDate: string;
  exitDate?: string;
  estimatedDate?: string;
  signatureTechnician?: string | null;
  signatureCustomer?: string | null;
  signedAt?: string | null;
  travelKm: number;
  travelHours: number;
  travelKmRate: number;
  travelHourRate: number;
  customer: { id: string; name: string; phone?: string; email?: string; address?: string };
  technician?: { id: string; name: string; pixKey?: string };
  orderParts: OrderPart[];
  workHours: WorkHour[];
  additionalCosts: AdditionalCost[];
  payments: Payment[];
  travelLegs: TravelLeg[];
}

/**
 * Totais da OS, calculados no backend por `computeOrderTotals`.
 * Retorno de GET /service-orders/:id/summary e campo `totals` de cada OS em
 * GET /service-orders/billing-report.
 */
export interface OrderTotals {
  partsTotal: number;
  hoursTotal: number;
  costsTotal: number;
  travelKmTotal: number;
  travelHourTotal: number;
  travelTotal: number;
  grandTotal: number;
  totalPaid: number;
  remaining: number;
}

/** OS do relatório de faturamento: já vem com os totais prontos. */
export type BillingOrder = ServiceOrder & { totals: OrderTotals };

// ─── Endpoints de relatórios ─────────────────────────────────────────────────

/** GET /reports/dashboard */
export interface DashboardReport {
  orders: {
    total: number;
    open: number;
    inProgress: number;
    finished: number;
    delivered: number;
  };
  revenue: { thisMonth: number; lastMonth: number };
  totalCustomers: number;
  customersThisMonth: number;
}

/** GET /reports/monthly-revenue */
export interface MonthlyRevenue {
  month: number;
  label: string;
  revenue: number;
  customersCount: number;
}

/** GET /reports/orders-by-status */
export interface StatusCount {
  status: OrderStatus;
  label: string;
  count: number;
}

/** GET /reports/top-customers */
export interface TopCustomer {
  customerId: string;
  name: string;
  count: number;
}
