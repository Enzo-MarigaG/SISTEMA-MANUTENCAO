'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Plus, Trash2, X, Printer, ChevronRight,
  User, Wrench, Package, Clock, Receipt, CreditCard,
  CalendarDays, FileText, DollarSign,
} from 'lucide-react';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type OrderStatus = 'OPEN' | 'IN_PROGRESS' | 'FINISHED' | 'DELIVERED';
type PaymentMethod = 'CASH' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'TRANSFER' | 'OTHER';
type PaymentStatus = 'PAID' | 'PENDING' | 'PARTIAL';

interface ServiceOrder {
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
  customer: { id: string; name: string; phone?: string; email?: string; address?: string };
  technician?: { id: string; name: string; pixKey?: string };
  orderParts: OrderPart[];
  workHours: WorkHour[];
  additionalCosts: AdditionalCost[];
  payments: Payment[];
}

interface OrderPart {
  id: string;
  partName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  part?: { sku?: string };
}

interface WorkHour {
  id: string;
  hours: number;
  hourlyRate: number;
  totalCost: number;
  workedDate: string;
  description?: string;
}

interface AdditionalCost {
  id: string;
  description: string;
  amount: number;
}

interface Payment {
  id: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentDate?: string;
  notes?: string;
}

interface Summary {
  partsTotal: number;
  hoursTotal: number;
  costsTotal: number;
  grandTotal: number;
  totalPaid: number;
  remaining: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusConfig: Record<OrderStatus, { label: string; color: string; dot: string; next?: OrderStatus; nextLabel?: string }> = {
  OPEN:        { label: 'Aberta',       color: 'bg-blue-50 text-blue-700 border-blue-200',    dot: 'bg-blue-500',   next: 'IN_PROGRESS', nextLabel: 'Iniciar' },
  IN_PROGRESS: { label: 'Em Andamento', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500', next: 'FINISHED',    nextLabel: 'Finalizar' },
  FINISHED:    { label: 'Finalizada',   color: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500',  next: 'DELIVERED',   nextLabel: 'Entregar' },
  DELIVERED:   { label: 'Entregue',     color: 'bg-gray-100 text-gray-600 border-gray-200',   dot: 'bg-gray-400' },
};

const paymentMethodLabel: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro', PIX: 'PIX', CREDIT_CARD: 'Cartão Crédito',
  DEBIT_CARD: 'Cartão Débito', TRANSFER: 'Transferência', OTHER: 'Outro',
};

const paymentStatusLabel: Record<PaymentStatus, { label: string; color: string }> = {
  PAID:    { label: 'Pago',     color: 'text-green-700 bg-green-50 border-green-200' },
  PENDING: { label: 'Pendente', color: 'text-red-600 bg-red-50 border-red-200' },
  PARTIAL: { label: 'Parcial',  color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
};

const fmt     = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-xl shadow-xl max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted"><X className="size-4" /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function SectionCard({
  title, action, children, icon: Icon, empty,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  icon?: React.ElementType;
  empty?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="size-4 text-muted-foreground" />}
          <h3 className="font-medium text-sm">{title}</h3>
        </div>
        {action}
      </div>
      <div className={empty ? 'py-8' : 'p-4'}>{children}</div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-muted-foreground">
      <Icon className="size-8 mb-2 opacity-25" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const partSchema = z.object({
  partName:  z.string().min(1, 'Nome da peça é obrigatório'),
  quantity:  z.coerce.number().min(1),
  unitPrice: z.coerce.number().min(0),
});

const workHourSchema = z.object({
  hours:       z.coerce.number().min(0.25, 'Mínimo 0,25h'),
  hourlyRate:  z.coerce.number().min(0),
  workedDate:  z.string().min(1, 'Data é obrigatória'),
  description: z.string().optional(),
});

const costSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória'),
  amount:      z.coerce.number().min(0),
});

const paymentSchema = z.object({
  amountPaid:    z.coerce.number().min(0.01),
  paymentMethod: z.enum(['CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER', 'OTHER']),
  paymentStatus: z.enum(['PAID', 'PENDING', 'PARTIAL']),
  paymentDate:   z.string().optional(),
  notes:         z.string().optional(),
});

// ─── Página ───────────────────────────────────────────────────────────────────

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router  = useRouter();
  const qc      = useQueryClient();
  const [modal, setModal] = useState<'part' | 'workHour' | 'cost' | 'payment' | null>(null);

  const { data: order, isLoading } = useQuery<ServiceOrder>({
    queryKey: ['service-order', id],
    queryFn:  () => api.get(`/service-orders/${id}`).then(r => r.data),
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: ['service-order-summary', id],
    queryFn:  () => api.get(`/service-orders/${id}/summary`).then(r => r.data),
    enabled:  !!order,
  });

  const { data: catalogParts = [] } = useQuery<{ id: string; name: string; unitPrice: number; sku?: string }[]>({
    queryKey: ['parts'],
    queryFn:  () => api.get('/parts').then(r => r.data),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['service-order', id] });
    qc.invalidateQueries({ queryKey: ['service-order-summary', id] });
    qc.invalidateQueries({ queryKey: ['service-orders'] });
  };

  const statusMutation      = useMutation({ mutationFn: (status: OrderStatus) => api.patch(`/service-orders/${id}/status`, { status }), onSuccess: invalidate });
  const addPartMutation      = useMutation({ mutationFn: (data: z.infer<typeof partSchema>) => api.post(`/service-orders/${id}/parts`, data), onSuccess: () => { invalidate(); setModal(null); } });
  const removePartMutation   = useMutation({ mutationFn: (orderPartId: string) => api.delete(`/service-orders/${id}/parts/${orderPartId}`), onSuccess: invalidate });
  const addWorkHourMutation  = useMutation({ mutationFn: (data: z.infer<typeof workHourSchema>) => api.post(`/service-orders/${id}/work-hours`, data), onSuccess: () => { invalidate(); setModal(null); } });
  const removeWorkHourMutation = useMutation({ mutationFn: (whId: string) => api.delete(`/service-orders/${id}/work-hours/${whId}`), onSuccess: invalidate });
  const addCostMutation      = useMutation({ mutationFn: (data: z.infer<typeof costSchema>) => api.post(`/service-orders/${id}/additional-costs`, data), onSuccess: () => { invalidate(); setModal(null); } });
  const removeCostMutation   = useMutation({ mutationFn: (costId: string) => api.delete(`/service-orders/${id}/additional-costs/${costId}`), onSuccess: invalidate });
  const addPaymentMutation   = useMutation({ mutationFn: (data: z.infer<typeof paymentSchema>) => api.post(`/service-orders/${id}/payments`, data), onSuccess: () => { invalidate(); setModal(null); } });
  const removePaymentMutation = useMutation({ mutationFn: (paymentId: string) => api.delete(`/service-orders/${id}/payments/${paymentId}`), onSuccess: invalidate });

  if (isLoading || !order) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statusCfg = statusConfig[order.status];
  const today     = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4 max-w-4xl print:max-w-none">

      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="print:hidden bg-card border border-border rounded-xl overflow-hidden">

        {/* Barra de status colorida no topo */}
        <div className={`h-1 w-full ${statusCfg.dot}`} />

        <div className="p-4 sm:p-5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" />
              Ordens de Serviço
            </button>
          </div>

          {/* Título + ações */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusCfg.color}`}>
                  {statusCfg.label}
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">OS #{order.orderNumber}</h1>
              <p className="text-base text-muted-foreground mt-0.5">{order.customer.name}</p>
              {order.equipment && (
                <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  <Wrench className="size-3.5 shrink-0" />
                  {order.equipment}
                </p>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              {statusCfg.next && (
                <Button
                  onClick={() => statusMutation.mutate(statusCfg.next!)}
                  disabled={statusMutation.isPending}
                >
                  {statusCfg.nextLabel}
                  <ChevronRight className="size-4" />
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => window.open(`/ordens/${id}/pdf`, '_blank')}
              >
                <Printer className="size-4" />
                Baixar PDF
              </Button>
            </div>
          </div>

          {/* Strip de datas */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              Entrada: {fmtDate(order.entryDate)}
            </span>
            {order.exitDate && (
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                Encerramento: {fmtDate(order.exitDate)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Cabeçalho impressão */}
      <div className="hidden print:block border-b pb-4 mb-4">
        <h1 className="text-2xl font-bold">Ordem de Serviço #{order.orderNumber}</h1>
        <p className="text-sm text-gray-500">{new Date().toLocaleDateString('pt-BR')}</p>
      </div>

      {/* ─── Cliente + OS ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SectionCard title="Cliente" icon={User}>
          <dl className="space-y-2.5 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Nome</dt>
              <dd className="font-medium">{order.customer.name}</dd>
            </div>
            {order.customer.phone && (
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Telefone</dt>
                <dd>{order.customer.phone}</dd>
              </div>
            )}
            {order.customer.email && (
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">E-mail</dt>
                <dd className="break-all">{order.customer.email}</dd>
              </div>
            )}
            {order.customer.address && (
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Endereço</dt>
                <dd>{order.customer.address}</dd>
              </div>
            )}
          </dl>
        </SectionCard>

        <SectionCard title="Informações da OS" icon={FileText}>
          <dl className="space-y-2.5 text-sm">
            {order.equipment && (
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Equipamento</dt>
                <dd className="font-medium">{order.equipment}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Data de Início</dt>
              <dd>{fmtDate(order.entryDate)}</dd>
            </div>
            {order.exitDate && (
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Data de Encerramento</dt>
                <dd>{fmtDate(order.exitDate)}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Status</dt>
              <dd>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusCfg.color}`}>
                  {statusCfg.label}
                </span>
              </dd>
            </div>
          </dl>
        </SectionCard>
      </div>

      {/* ─── Problema / Serviço ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SectionCard title="Problema Relatado" icon={Wrench}>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{order.problemReported}</p>
        </SectionCard>
        <SectionCard title="Serviço Realizado" icon={Wrench}>
          <p className={`text-sm whitespace-pre-wrap leading-relaxed ${!order.serviceDone ? 'text-muted-foreground italic' : ''}`}>
            {order.serviceDone || 'Não preenchido'}
          </p>
        </SectionCard>
      </div>

      {order.observations && (
        <SectionCard title="Observações Técnicas" icon={FileText}>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{order.observations}</p>
        </SectionCard>
      )}

      {/* ─── Peças ────────────────────────────────────────────────────────────── */}
      <SectionCard
        title={`Peças Utilizadas${order.orderParts.length > 0 ? ` (${order.orderParts.length})` : ''}`}
        icon={Package}
        empty={order.orderParts.length === 0}
        action={
          <button onClick={() => setModal('part')} className="flex items-center gap-1 text-xs text-primary hover:underline print:hidden">
            <Plus className="size-3" /> Adicionar
          </button>
        }
      >
        {order.orderParts.length === 0 ? (
          <EmptyState icon={Package} text="Nenhuma peça registrada" />
        ) : (
          <>
            <div className="sm:hidden space-y-2">
              {order.orderParts.map(p => (
                <div key={p.id} className="flex items-start justify-between gap-2 py-2.5 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.partName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.quantity}× {fmt(p.unitPrice)} = <span className="font-semibold text-foreground">{fmt(p.totalPrice)}</span>
                    </p>
                  </div>
                  <button onClick={() => removePartMutation.mutate(p.id)} className="p-1.5 hover:text-destructive transition-colors text-muted-foreground print:hidden shrink-0">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <table className="hidden sm:table w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2.5 font-medium text-muted-foreground">Peça</th>
                  <th className="pb-2.5 font-medium text-muted-foreground text-center">Qtd</th>
                  <th className="pb-2.5 font-medium text-muted-foreground text-right">Unitário</th>
                  <th className="pb-2.5 font-medium text-muted-foreground text-right">Total</th>
                  <th className="pb-2.5 w-8 print:hidden" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.orderParts.map(p => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2.5">{p.partName}</td>
                    <td className="py-2.5 text-center text-muted-foreground">{p.quantity}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{fmt(p.unitPrice)}</td>
                    <td className="py-2.5 text-right font-semibold">{fmt(p.totalPrice)}</td>
                    <td className="py-2.5 print:hidden">
                      <button onClick={() => removePartMutation.mutate(p.id)} className="p-1 hover:text-destructive transition-colors text-muted-foreground">
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </SectionCard>

      {/* ─── Horas Trabalhadas ─────────────────────────────────────────────────── */}
      <SectionCard
        title={`Horas Trabalhadas${order.workHours.length > 0 ? ` (${order.workHours.length})` : ''}`}
        icon={Clock}
        empty={order.workHours.length === 0}
        action={
          <button onClick={() => setModal('workHour')} className="flex items-center gap-1 text-xs text-primary hover:underline print:hidden">
            <Plus className="size-3" /> Adicionar
          </button>
        }
      >
        {order.workHours.length === 0 ? (
          <EmptyState icon={Clock} text="Nenhuma hora registrada" />
        ) : (
          <>
            <div className="sm:hidden space-y-2">
              {order.workHours.map(wh => (
                <div key={wh.id} className="flex items-start justify-between gap-2 py-2.5 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{fmtDate(wh.workedDate)}{wh.description ? ` — ${wh.description}` : ''}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {wh.hours}h × {fmt(wh.hourlyRate)} = <span className="font-semibold text-foreground">{fmt(wh.totalCost)}</span>
                    </p>
                  </div>
                  <button onClick={() => removeWorkHourMutation.mutate(wh.id)} className="p-1.5 hover:text-destructive transition-colors text-muted-foreground print:hidden shrink-0">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <table className="hidden sm:table w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2.5 font-medium text-muted-foreground">Data</th>
                  <th className="pb-2.5 font-medium text-muted-foreground">Descrição</th>
                  <th className="pb-2.5 font-medium text-muted-foreground text-center">Horas</th>
                  <th className="pb-2.5 font-medium text-muted-foreground text-right">Valor/h</th>
                  <th className="pb-2.5 font-medium text-muted-foreground text-right">Total</th>
                  <th className="pb-2.5 w-8 print:hidden" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.workHours.map(wh => (
                  <tr key={wh.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2.5">{fmtDate(wh.workedDate)}</td>
                    <td className="py-2.5 text-muted-foreground">{wh.description || '—'}</td>
                    <td className="py-2.5 text-center">{wh.hours}h</td>
                    <td className="py-2.5 text-right text-muted-foreground">{fmt(wh.hourlyRate)}</td>
                    <td className="py-2.5 text-right font-semibold">{fmt(wh.totalCost)}</td>
                    <td className="py-2.5 print:hidden">
                      <button onClick={() => removeWorkHourMutation.mutate(wh.id)} className="p-1 hover:text-destructive transition-colors text-muted-foreground">
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </SectionCard>

      {/* ─── Custos Adicionais ────────────────────────────────────────────────── */}
      <SectionCard
        title={`Custos Adicionais${order.additionalCosts.length > 0 ? ` (${order.additionalCosts.length})` : ''}`}
        icon={Receipt}
        empty={order.additionalCosts.length === 0}
        action={
          <button onClick={() => setModal('cost')} className="flex items-center gap-1 text-xs text-primary hover:underline print:hidden">
            <Plus className="size-3" /> Adicionar
          </button>
        }
      >
        {order.additionalCosts.length === 0 ? (
          <EmptyState icon={Receipt} text="Nenhum custo adicional" />
        ) : (
          <div className="divide-y divide-border">
            {order.additionalCosts.map(c => (
              <div key={c.id} className="flex items-center justify-between text-sm py-2.5 hover:bg-muted/20 transition-colors -mx-4 px-4">
                <span className="truncate mr-3">{c.description}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-semibold">{fmt(c.amount)}</span>
                  <button onClick={() => removeCostMutation.mutate(c.id)} className="p-1 hover:text-destructive transition-colors text-muted-foreground print:hidden">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ─── Financeiro + Pagamentos ──────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <DollarSign className="size-4 text-muted-foreground" />
            <h3 className="font-medium text-sm">Financeiro</h3>
          </div>
          <button onClick={() => setModal('payment')} className="flex items-center gap-1 text-xs text-primary hover:underline print:hidden">
            <Plus className="size-3" /> Registrar pagamento
          </button>
        </div>

        {/* Breakdown */}
        {summary && (
          <div className="p-4 space-y-2 text-sm">
            {summary.partsTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Peças</span>
                <span>{fmt(summary.partsTotal)}</span>
              </div>
            )}
            {summary.costsTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custos Adicionais</span>
                <span>{fmt(summary.costsTotal)}</span>
              </div>
            )}
          </div>
        )}

        {/* Total */}
        {summary && (
          <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t border-border">
            <span className="font-semibold text-sm">Total Geral</span>
            <span className="text-2xl font-bold tracking-tight">{fmt(summary.grandTotal)}</span>
          </div>
        )}

        {/* Chave PIX */}
        {order.technician?.pixKey && (
          <div className="mx-4 my-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-3 text-sm">
            <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
              PIX
            </div>
            <div className="min-w-0">
              <p className="text-xs text-emerald-700 font-medium">Chave PIX para pagamento</p>
              <p className="font-mono font-semibold text-emerald-900 break-all">{order.technician.pixKey}</p>
            </div>
          </div>
        )}

        {/* Lista de pagamentos (só exibe se houver) */}
        {order.payments.length > 0 && (
          <div className="border-t border-border divide-y divide-border">
            {order.payments.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm py-2.5 hover:bg-muted/20 transition-colors px-4">
                <div className="min-w-0">
                  <p className="font-semibold">{fmt(p.amountPaid)}</p>
                  {p.paymentDate && <p className="text-xs text-muted-foreground">{fmtDate(p.paymentDate)}</p>}
                </div>
                <button onClick={() => removePaymentMutation.mutate(p.id)} className="p-1 hover:text-destructive transition-colors text-muted-foreground print:hidden shrink-0">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Valor a ser cobrado */}
        {summary && (
          <div className="px-4 py-3 border-t border-border space-y-1.5 text-sm bg-muted/10">
            {summary.totalPaid > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Pago</span>
                <span className="font-semibold">{fmt(summary.totalPaid)}</span>
              </div>
            )}
            <div className="flex justify-between text-red-600">
              <span className="font-semibold">Valor a ser cobrado</span>
              <span className="font-bold">{fmt(summary.remaining > 0 ? summary.remaining : summary.grandTotal)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Modais ───────────────────────────────────────────────────────────── */}
      {modal === 'part' && (
        <PartModal parts={catalogParts} onClose={() => setModal(null)} onSubmit={(d) => addPartMutation.mutate(d)} isLoading={addPartMutation.isPending} />
      )}
      {modal === 'workHour' && (
        <WorkHourModal defaultDate={today} onClose={() => setModal(null)} onSubmit={(d) => addWorkHourMutation.mutate(d)} isLoading={addWorkHourMutation.isPending} />
      )}
      {modal === 'cost' && (
        <CostModal onClose={() => setModal(null)} onSubmit={(d) => addCostMutation.mutate(d)} isLoading={addCostMutation.isPending} />
      )}
      {modal === 'payment' && (
        <PaymentModal defaultDate={today} grandTotal={summary?.grandTotal} onClose={() => setModal(null)} onSubmit={(d) => addPaymentMutation.mutate(d)} isLoading={addPaymentMutation.isPending} />
      )}
    </div>
  );
}

// ─── Modais ───────────────────────────────────────────────────────────────────

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors';

function PartModal({ parts, onClose, onSubmit, isLoading }: {
  parts: { id: string; name: string; unitPrice: number; sku?: string }[];
  onClose: () => void;
  onSubmit: (d: z.infer<typeof partSchema>) => void;
  isLoading: boolean;
}) {
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<z.infer<typeof partSchema>>({ resolver: zodResolver(partSchema) });

  function selectCatalog(e: React.ChangeEvent<HTMLSelectElement>) {
    const part = parts.find(p => p.id === e.target.value);
    if (part) { setValue('partName', part.name); setValue('unitPrice', part.unitPrice); }
  }

  return (
    <Modal title="Adicionar Peça" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {parts.length > 0 && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Selecionar do catálogo</label>
            <select className={inputClass} onChange={selectCatalog} defaultValue="">
              <option value="">— selecione ou preencha manualmente —</option>
              {parts.map(p => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
            </select>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-sm font-medium">Nome da Peça *</label>
          <input className={inputClass} {...register('partName')} />
          {errors.partName && <p className="text-xs text-destructive">{errors.partName.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Quantidade *</label>
            <input type="number" min="1" className={inputClass} {...register('quantity')} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Preço Unitário (R$) *</label>
            <input type="number" step="0.01" min="0" className={inputClass} {...register('unitPrice')} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isLoading}>{isLoading ? 'Salvando...' : 'Adicionar'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function WorkHourModal({ defaultDate, onClose, onSubmit, isLoading }: {
  defaultDate: string;
  onClose: () => void;
  onSubmit: (d: z.infer<typeof workHourSchema>) => void;
  isLoading: boolean;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof workHourSchema>>({
    resolver: zodResolver(workHourSchema),
    defaultValues: { workedDate: defaultDate, hourlyRate: 80 },
  });
  return (
    <Modal title="Registrar Horas" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Horas *</label>
            <input type="number" step="0.25" min="0.25" className={inputClass} {...register('hours')} />
            {errors.hours && <p className="text-xs text-destructive">{errors.hours.message}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Valor/hora (R$) *</label>
            <input type="number" step="0.01" min="0" className={inputClass} {...register('hourlyRate')} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Data *</label>
          <input type="date" className={inputClass} {...register('workedDate')} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Descrição</label>
          <input className={inputClass} placeholder="Ex: Diagnóstico e troca de peças" {...register('description')} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isLoading}>{isLoading ? 'Salvando...' : 'Registrar'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function CostModal({ onClose, onSubmit, isLoading }: {
  onClose: () => void;
  onSubmit: (d: z.infer<typeof costSchema>) => void;
  isLoading: boolean;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof costSchema>>({ resolver: zodResolver(costSchema) });
  return (
    <Modal title="Custo Adicional" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Descrição *</label>
          <input className={inputClass} placeholder="Ex: Frete, embalagem..." {...register('description')} />
          {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Valor (R$) *</label>
          <input type="number" step="0.01" min="0" className={inputClass} {...register('amount')} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isLoading}>{isLoading ? 'Salvando...' : 'Adicionar'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function PaymentModal({ defaultDate, grandTotal, onClose, onSubmit, isLoading }: {
  defaultDate: string;
  grandTotal?: number;
  onClose: () => void;
  onSubmit: (d: z.infer<typeof paymentSchema>) => void;
  isLoading: boolean;
}) {
  const { register, handleSubmit, setValue } = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { paymentMethod: 'PIX', paymentStatus: 'PAID', paymentDate: defaultDate },
  });
  return (
    <Modal title="Registrar Pagamento" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Valor Pago (R$) *</label>
            {grandTotal != null && grandTotal > 0 && (
              <button
                type="button"
                onClick={() => setValue('amountPaid', grandTotal)}
                className="text-xs text-primary hover:underline"
              >
                Usar total ({grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
              </button>
            )}
          </div>
          <input type="number" step="0.01" min="0.01" className={inputClass} {...register('amountPaid')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Forma de Pagamento</label>
            <select className={inputClass} {...register('paymentMethod')}>
              <option value="PIX">PIX</option>
              <option value="CASH">Dinheiro</option>
              <option value="CREDIT_CARD">Cartão Crédito</option>
              <option value="DEBIT_CARD">Cartão Débito</option>
              <option value="TRANSFER">Transferência</option>
              <option value="OTHER">Outro</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Status</label>
            <select className={inputClass} {...register('paymentStatus')}>
              <option value="PAID">Pago</option>
              <option value="PARTIAL">Parcial</option>
              <option value="PENDING">Pendente</option>
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Data do Pagamento</label>
          <input type="date" className={inputClass} {...register('paymentDate')} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Observações</label>
          <input className={inputClass} {...register('notes')} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isLoading}>{isLoading ? 'Salvando...' : 'Registrar'}</Button>
        </div>
      </form>
    </Modal>
  );
}
