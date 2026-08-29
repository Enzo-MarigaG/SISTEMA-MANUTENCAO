'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  ClipboardList,
  TrendingUp,
  TrendingDown,
  Package,
  ArrowRight,
  AlertTriangle,
  CircleDollarSign,
  PlusCircle,
} from 'lucide-react';

interface MonthlyRevenue {
  month: number;
  label: string;
  revenue: number;
}

interface Stats {
  total: number;
  open: number;
  inProgress: number;
  finished: number;
  delivered: number;
  revenueMonth: number;
  revenuePrevMonth: number;
  revenueChange: number | null;
  revenueTotal: number;
  pendingAmount: number;
  ordersThisMonth: number;
  lowStockParts: number;
}

const STATUS = {
  OPEN: { label: 'Aberta', color: '#3b82f6', dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700' },
  IN_PROGRESS: { label: 'Em Andamento', color: '#f59e0b', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700' },
  FINISHED: { label: 'Finalizada', color: '#22c55e', dot: 'bg-green-500', badge: 'bg-green-50 text-green-700' },
  DELIVERED: { label: 'Entregue', color: '#94a3b8', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600' },
} as const;

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconColor,
  accent,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  accent: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1.5 truncate text-2xl font-bold tracking-tight">{value}</p>
          {sub && <div className="mt-1.5 text-xs">{sub}</div>}
        </div>
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className={`size-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['service-orders-stats'],
    queryFn: () => api.get('/service-orders/stats').then((r) => r.data),
  });

  const { data: monthlyRevenue = [] } = useQuery<MonthlyRevenue[]>({
    queryKey: ['reports-monthly', year],
    queryFn: () =>
      api.get('/reports/monthly-revenue', { params: { year } }).then((r) => r.data),
  });

  const { data: recentOrders } = useQuery({
    queryKey: ['service-orders-recent'],
    queryFn: () =>
      api
        .get('/service-orders?status=OPEN')
        .then((r) => r.data.slice(0, 6) as Record<string, unknown>[]),
  });

  if (isLoading || !stats) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const activeTotal = stats.open + stats.inProgress + stats.finished + stats.delivered;
  const statusData = [
    { key: 'OPEN', value: stats.open },
    { key: 'IN_PROGRESS', value: stats.inProgress },
    { key: 'FINISHED', value: stats.finished },
    { key: 'DELIVERED', value: stats.delivered },
  ].filter((d) => d.value > 0);

  const change = stats.revenueChange;
  const firstName = user?.name?.split(' ')[0] ?? '';
  const chartData = monthlyRevenue.map((m) => ({ ...m, shortLabel: m.label.slice(0, 3) }));
  const yearTotal = monthlyRevenue.reduce((a, b) => a + b.revenue, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">
            Aqui está o resumo da sua operação de manutenção.
          </p>
        </div>
        <p className="text-sm capitalize text-muted-foreground">
          {new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <KpiCard
          label="Faturamento do mês"
          value={brl(stats.revenueMonth)}
          icon={CircleDollarSign}
          iconBg="bg-green-100"
          iconColor="text-green-700"
          accent="bg-green-500"
          sub={
            change === null ? (
              <span className="text-muted-foreground">Sem base do mês anterior</span>
            ) : (
              <span
                className={`inline-flex items-center gap-1 font-medium ${
                  change >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {change >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {change >= 0 ? '+' : ''}
                {change}% vs. mês anterior
              </span>
            )
          }
        />
        <KpiCard
          label="Total de OS"
          value={String(stats.total)}
          icon={ClipboardList}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          accent="bg-primary"
          sub={<span className="text-muted-foreground">{stats.ordersThisMonth} criadas este mês</span>}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Trend */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Faturamento mensal</h2>
              <p className="text-xs text-muted-foreground">{brl(yearTotal)} no ano</p>
            </div>
            <select
              className="rounded-lg border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="shortLabel"
                tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
                formatter={(v) => [brl(Number(v ?? 0)), 'Faturamento']}
                contentStyle={{
                  background: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <Bar dataKey="revenue" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status donut */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-1 text-sm font-semibold">Distribuição por status</h2>
          <p className="mb-2 text-xs text-muted-foreground">{activeTotal} ordens no total</p>
          {statusData.length === 0 ? (
            <div className="flex h-50 flex-col items-center justify-center text-muted-foreground">
              <Package className="mb-2 size-7 opacity-30" />
              <p className="text-sm">Sem dados</p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative shrink-0">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="key"
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {statusData.map((d) => (
                        <Cell key={d.key} fill={STATUS[d.key as keyof typeof STATUS].color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--card)',
                        fontSize: 12,
                      }}
                      formatter={(value, _name, item) => [
                        `${value} ordens`,
                        STATUS[(item?.payload as { key: keyof typeof STATUS }).key].label,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold leading-none">{activeTotal}</span>
                  <span className="text-[10px] text-muted-foreground">ordens</span>
                </div>
              </div>
              <ul className="flex-1 space-y-1.5">
                {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map((k) => {
                  const cfg = STATUS[k];
                  const value =
                    k === 'OPEN'
                      ? stats.open
                      : k === 'IN_PROGRESS'
                        ? stats.inProgress
                        : k === 'FINISHED'
                          ? stats.finished
                          : stats.delivered;
                  return (
                    <li key={k} className="flex items-center gap-2 text-xs">
                      <span className="size-2.5 rounded-full" style={{ background: cfg.color }} />
                      <span className="flex-1 text-muted-foreground">{cfg.label}</span>
                      <span className="font-semibold">{value}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent orders */}
        <div className="overflow-hidden rounded-xl border border-border bg-card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">Ordens abertas recentes</h2>
            <Link
              href="/ordens"
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Ver todas <ArrowRight className="size-3" />
            </Link>
          </div>

          {!recentOrders?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="mb-2 size-8 opacity-30" />
              <p className="text-sm">Nenhuma ordem aberta</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentOrders.map((order) => {
                const customer = order.customer as { name: string } | undefined;
                const status = order.status as keyof typeof STATUS;
                const cfg = STATUS[status] ?? {
                  label: status,
                  dot: 'bg-slate-400',
                  badge: 'bg-slate-100 text-slate-600',
                };
                return (
                  <button
                    key={order.id as string}
                    onClick={() => router.push(`/ordens/${order.id as string}`)}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className={`size-2 shrink-0 rounded-full ${cfg.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        OS #{order.orderNumber as number} — {customer?.name ?? '—'}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {(order.equipment as string) || (order.problemReported as string)}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Alerts & quick actions */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold">Pendências</h2>
            <ul className="space-y-2.5">
              <li className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-green-100 text-green-700">
                  <ClipboardList className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{stats.finished} finalizadas</p>
                  <p className="text-xs text-muted-foreground">aguardando entrega</p>
                </div>
              </li>
              <li className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <AlertTriangle className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{brl(stats.pendingAmount)}</p>
                  <p className="text-xs text-muted-foreground">pagamentos pendentes</p>
                </div>
              </li>
            </ul>
          </div>

          <button
            onClick={() => router.push('/ordens')}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <PlusCircle className="size-4" />
            Nova ordem de serviço
          </button>
        </div>
      </div>
    </div>
  );
}
