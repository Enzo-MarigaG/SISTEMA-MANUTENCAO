'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Plus, Search, Eye, X, UserPlus, Users, ClipboardX } from 'lucide-react';

type OrderStatus = 'OPEN' | 'IN_PROGRESS' | 'FINISHED' | 'DELIVERED';

interface Customer {
  id: string;
  name: string;
}

interface ServiceOrder {
  id: string;
  orderNumber: number;
  customer: { id: string; name: string; phone?: string };
  technician?: { id: string; name: string };
  equipment?: string;
  problemReported: string;
  status: OrderStatus;
  entryDate: string;
  exitDate?: string;
}

const statusConfig: Record<OrderStatus, { label: string; badge: string; bar: string; cardBorder: string }> = {
  OPEN: {
    label: 'Aberta',
    badge: 'text-blue-700 bg-blue-50 border-blue-200',
    bar: 'bg-blue-500',
    cardBorder: 'border-l-blue-500',
  },
  IN_PROGRESS: {
    label: 'Em Andamento',
    badge: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    bar: 'bg-yellow-500',
    cardBorder: 'border-l-yellow-500',
  },
  FINISHED: {
    label: 'Finalizada',
    badge: 'text-green-700 bg-green-50 border-green-200',
    bar: 'bg-green-500',
    cardBorder: 'border-l-green-500',
  },
  DELIVERED: {
    label: 'Entregue',
    badge: 'text-gray-600 bg-gray-100 border-gray-200',
    bar: 'bg-gray-400',
    cardBorder: 'border-l-gray-300',
  },
};

const createSchema = z.object({
  customerId: z.string().optional(),
  newCustomerName: z.string().optional(),
  newCustomerPhone: z.string().optional(),
  newCustomerEmail: z.string().optional(),
  equipment: z.string().optional(),
  problemReported: z.string().min(1, 'Problema relatado é obrigatório'),
  serviceDone: z.string().optional(),
  observations: z.string().optional(),
  entryDate: z.string().optional(),
  estimatedDate: z.string().optional(),
}).superRefine((data, ctx) => {
  if (!data.customerId && !data.newCustomerName) {
    ctx.addIssue({ code: 'custom', message: 'Selecione um cliente ou informe o nome', path: ['customerId'] });
  }
  if (data.newCustomerName !== undefined && data.newCustomerName === '' && !data.customerId) {
    ctx.addIssue({ code: 'custom', message: 'Nome do cliente é obrigatório', path: ['newCustomerName'] });
  }
});

type CreateFormData = z.infer<typeof createSchema>;

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-xl shadow-xl max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function CreateOrderForm({ customers, onSubmit, onCancel, isSubmitting }: {
  customers: Customer[];
  onSubmit: (data: CreateFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [customerMode, setCustomerMode] = useState<'select' | 'create'>('select');

  const { register, handleSubmit, setValue, clearErrors, formState: { errors } } = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
  });

  const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors';

  function switchToCreate() {
    setCustomerMode('create');
    setValue('customerId', '');
    clearErrors('customerId');
  }

  function switchToSelect() {
    setCustomerMode('select');
    setValue('newCustomerName', '');
    setValue('newCustomerPhone', '');
    setValue('newCustomerEmail', '');
    clearErrors('newCustomerName');
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Cliente *</label>
          {customerMode === 'select' ? (
            <button type="button" onClick={switchToCreate} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <UserPlus className="size-3" /> Cadastrar novo
            </button>
          ) : (
            <button type="button" onClick={switchToSelect} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <Users className="size-3" /> Selecionar existente
            </button>
          )}
        </div>

        {customerMode === 'select' ? (
          <>
            <select className={inputClass} {...register('customerId')}>
              <option value="">Selecione um cliente...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.customerId && <p className="text-xs text-destructive">{errors.customerId.message}</p>}
          </>
        ) : (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome *</label>
              <input className={inputClass} placeholder="Nome completo do cliente" {...register('newCustomerName')} />
              {errors.newCustomerName && <p className="text-xs text-destructive">{errors.newCustomerName.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Telefone</label>
                <input className={inputClass} placeholder="(00) 00000-0000" {...register('newCustomerPhone')} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">E-mail</label>
                <input type="email" className={inputClass} placeholder="email@exemplo.com" {...register('newCustomerEmail')} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Equipamento</label>
        <input className={inputClass} placeholder="Ex: Notebook Dell Inspiron" {...register('equipment')} />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Problema Relatado *</label>
        <textarea className={`${inputClass} resize-none`} rows={3} placeholder="Descreva o problema..." {...register('problemReported')} />
        {errors.problemReported && <p className="text-xs text-destructive">{errors.problemReported.message}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Serviço Realizado</label>
        <textarea className={`${inputClass} resize-none`} rows={2} placeholder="Descreva o serviço executado..." {...register('serviceDone')} />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Observações</label>
        <textarea className={`${inputClass} resize-none`} rows={2} {...register('observations')} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Data de Início</label>
          <input type="date" className={inputClass} {...register('entryDate')} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Previsão de Entrega</label>
          <input type="date" className={inputClass} {...register('estimatedDate')} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Criando...' : 'Criar OS'}</Button>
      </div>
    </form>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = statusConfig[status];
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.badge}`}>
      {cfg.label}
    </span>
  );
}

const statusFilters: { value: OrderStatus | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'OPEN', label: 'Abertas' },
  { value: 'IN_PROGRESS', label: 'Em Andamento' },
  { value: 'FINISHED', label: 'Finalizadas' },
];

export default function OrdensPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<OrderStatus | ''>('');
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery<ServiceOrder[]>({
    queryKey: ['service-orders', search, filterStatus],
    queryFn: () =>
      api.get('/service-orders', {
        params: {
          ...(search && { search }),
          ...(filterStatus && { status: filterStatus }),
        },
      }).then((r) => r.data),
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers-select'],
    queryFn: () => api.get('/customers').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateFormData) => {
      let customerId = data.customerId;

      if (!customerId && data.newCustomerName) {
        const resp = await api.post('/customers', {
          name: data.newCustomerName,
          phone: data.newCustomerPhone || undefined,
          email: data.newCustomerEmail || undefined,
        });
        customerId = resp.data.id;
      }

      return api.post('/service-orders', {
        customerId,
        equipment: data.equipment || undefined,
        problemReported: data.problemReported,
        serviceDone: data.serviceDone || undefined,
        observations: data.observations || undefined,
        entryDate: data.entryDate || undefined,
        estimatedDate: data.estimatedDate || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-orders'] });
      qc.invalidateQueries({ queryKey: ['service-orders-stats'] });
      qc.invalidateQueries({ queryKey: ['customers-select'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      setCreateError(null);
      setShowCreate(false);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setCreateError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao criar ordem de serviço'));
    },
  });

  return (
    <div className="space-y-5 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Ordens de Serviço</h1>
          <p className="text-sm text-muted-foreground">
            {orders.length} ordem{orders.length !== 1 ? 's' : ''} encontrada{orders.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Nova OS</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            placeholder="Buscar por cliente, equipamento ou problema..."
            className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {statusFilters.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilterStatus(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border
                ${filterStatus === value
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground'
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-card border border-border rounded-xl">
          <ClipboardX className="size-10 mb-3 opacity-25" />
          <p className="text-sm font-medium">Nenhuma ordem encontrada</p>
          <p className="text-xs mt-1">Tente ajustar os filtros ou crie uma nova OS</p>
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="sm:hidden space-y-2">
            {orders.map((o) => {
              const cfg = statusConfig[o.status];
              return (
                <button
                  key={o.id}
                  onClick={() => router.push(`/ordens/${o.id}`)}
                  className={`w-full text-left bg-card border border-l-4 ${cfg.cardBorder} border-border rounded-xl p-4 hover:bg-muted/30 transition-colors active:scale-[0.99]`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="font-semibold text-sm">OS #{o.orderNumber}</p>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="text-sm font-medium">{o.customer.name}</p>
                  {o.equipment && <p className="text-xs text-muted-foreground mt-0.5">{o.equipment}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{o.problemReported}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Entrada: {new Date(o.entryDate).toLocaleDateString('pt-BR')}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden sm:block bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="w-1 p-0" />
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">OS</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground hidden md:table-cell">Equipamento</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground hidden lg:table-cell">Entrada</th>
                    <th className="px-5 py-3 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((o) => {
                    const cfg = statusConfig[o.status];
                    return (
                      <tr key={o.id} className="hover:bg-muted/25 transition-colors">
                        <td className={`w-1 p-0 ${cfg.bar}`} />
                        <td className="px-5 py-3.5 font-semibold text-foreground/80">#{o.orderNumber}</td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium">{o.customer.name}</p>
                          {o.customer.phone && <p className="text-xs text-muted-foreground">{o.customer.phone}</p>}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell max-w-48 truncate">
                          {o.equipment || '—'}
                        </td>
                        <td className="px-5 py-3.5"><StatusBadge status={o.status} /></td>
                        <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell">
                          {new Date(o.entryDate).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => router.push(`/ordens/${o.id}`)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
                            title="Ver detalhes"
                          >
                            <Eye className="size-3.5" />
                            <span className="hidden xl:inline">Ver</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showCreate && (
        <Modal title="Nova Ordem de Serviço" onClose={() => { setShowCreate(false); setCreateError(null); }}>
          {createError && (
            <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {createError}
            </div>
          )}
          <CreateOrderForm
            customers={customers}
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={() => { setShowCreate(false); setCreateError(null); }}
            isSubmitting={createMutation.isPending}
          />
        </Modal>
      )}
    </div>
  );
}
