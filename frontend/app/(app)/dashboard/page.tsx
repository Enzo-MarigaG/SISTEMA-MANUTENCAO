'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ClipboardList, Clock, CheckCircle, TrendingUp, Package, ArrowRight } from 'lucide-react';

interface Stats {
  total: number;
  open: number;
  inProgress: number;
  finished: number;
  delivered: number;
}

const statusConfig: Record<string, { label: string; dot: string; badge: string }> = {
  OPEN: { label: 'Aberta', dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700' },
  IN_PROGRESS: { label: 'Em Andamento', dot: 'bg-yellow-500', badge: 'bg-yellow-50 text-yellow-700' },
  FINISHED: { label: 'Finalizada', dot: 'bg-green-500', badge: 'bg-green-50 text-green-700' },
  DELIVERED: { label: 'Entregue', dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600' },
};

function StatCard({
  label, value, icon: Icon, iconBg, iconColor, accent,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  accent: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 relative overflow-hidden">
      <div className={`absolute inset-y-0 left-0 w-1 ${accent} rounded-l-xl`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
        </div>
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${iconBg}`}>
          <Icon className={`size-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['service-orders-stats'],
    queryFn: () => api.get('/service-orders/stats').then((r) => r.data),
  });

  const { data: recentOrders } = useQuery({
    queryKey: ['service-orders-recent'],
    queryFn: () =>
      api
        .get('/service-orders?status=OPEN')
        .then((r) => r.data.slice(0, 8) as Record<string, unknown>[]),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do sistema de manutenção</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total de OS"
          value={stats?.total ?? 0}
          icon={ClipboardList}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          accent="bg-primary"
        />
        <StatCard
          label="Abertas"
          value={stats?.open ?? 0}
          icon={Clock}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          accent="bg-blue-500"
        />
        <StatCard
          label="Em Andamento"
          value={stats?.inProgress ?? 0}
          icon={TrendingUp}
          iconBg="bg-yellow-100"
          iconColor="text-yellow-700"
          accent="bg-yellow-500"
        />
        <StatCard
          label="Finalizadas"
          value={(stats?.finished ?? 0) + (stats?.delivered ?? 0)}
          icon={CheckCircle}
          iconBg="bg-green-100"
          iconColor="text-green-700"
          accent="bg-green-500"
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-sm">Ordens Abertas Recentes</h2>
          <a
            href="/ordens"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver todas <ArrowRight className="size-3" />
          </a>
        </div>

        {!recentOrders?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Package className="size-8 mb-2 opacity-30" />
            <p className="text-sm">Nenhuma ordem aberta</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentOrders.map((order) => {
              const customer = order.customer as { name: string } | undefined;
              const status = order.status as string;
              const cfg = statusConfig[status] ?? { label: status, dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600' };
              return (
                <button
                  key={order.id as string}
                  onClick={() => router.push(`/ordens/${order.id as string}`)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors text-left"
                >
                  <div className={`shrink-0 w-2 h-2 rounded-full ${cfg.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      OS #{order.orderNumber as number} — {customer?.name ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {(order.equipment as string) || (order.problemReported as string)}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
