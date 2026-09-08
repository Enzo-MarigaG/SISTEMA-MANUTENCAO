'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '@/lib/api';
import { TrendingUp, TrendingDown, DollarSign, Users, ClipboardList, Download, FileText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  BillingOrder, DashboardReport, MonthlyRevenue, StatusCount, TopCustomer,
} from '@/lib/types';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const PIE_COLORS = ['#3b82f6', '#eab308', '#22c55e', '#6b7280'];

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Os totais de cada OS vêm prontos do backend (computeOrderTotals), a mesma
// fórmula do resumo financeiro da OS. Não recalcular aqui — foi a duplicação
// dessa conta que fez o faturamento por cliente ficar sem o deslocamento.

// ── Gerador PDF mensal ────────────────────────────────────────────────────────
async function gerarPdfMensal(dashboard: DashboardReport, byStatus: StatusCount[]) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const L = 14, R = W - 14;
  let y = 0;

  const now = new Date();
  const mesLabel = `${MONTHS_PT[now.getMonth()]} ${now.getFullYear()}`;

  const nl = (n = 5) => { y += n; };
  const text = (t: string, x: number, yy: number,
    opts: { size?: number; bold?: boolean; color?: [number,number,number]; align?: 'left'|'right'|'center' } = {}) => {
    pdf.setFontSize(opts.size ?? 10);
    pdf.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    if (opts.color) pdf.setTextColor(...opts.color); else pdf.setTextColor(0,0,0);
    pdf.text(t, x, yy, { align: opts.align ?? 'left' });
    pdf.setTextColor(0,0,0);
  };
  const hline = (yy = y, color = [200,200,200] as [number,number,number]) => {
    pdf.setDrawColor(...color); pdf.line(L, yy, R, yy); pdf.setDrawColor(0,0,0);
  };
  const section = (title: string) => {
    nl(5);
    pdf.setFillColor(245,245,245);
    pdf.rect(L, y, R-L, 6, 'F');
    text(title.toUpperCase(), L+2, y+4.3, { size: 7.5, bold: true, color: [90,90,90] });
    y += 6; nl(4);
  };
  const row = (label: string, value: string, bold = false, color?: [number,number,number]) => {
    text(label, L, y, { size: 10, bold, color: color ?? (bold ? [0,0,0] : [90,90,90]) });
    text(value, R, y, { size: 10, bold, align: 'right', color: color ?? [0,0,0] });
    nl(bold ? 7 : 6);
  };

  // Cabeçalho
  y = 18;
  text('ARC SOLUÇÕES INDUSTRIAIS', L, y, { size: 16, bold: true });
  nl(7);
  text(`Relatório Mensal — ${mesLabel}`, L, y, { size: 11, color: [70,70,70] });
  nl(5);
  text(`Emitido em ${now.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })}`, L, y, { size: 8, color: [150,150,150] });
  nl(5);
  pdf.setLineWidth(0.5); hline(y, [0,0,0]); pdf.setLineWidth(0.2);

  // Faturamento
  section('Faturamento');
  const thisMonth = dashboard?.revenue?.thisMonth ?? 0;
  const lastMonth = dashboard?.revenue?.lastMonth ?? 0;
  const diff = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : null;
  row('Faturamento do Mês', fmt(thisMonth), true);
  row('Mês Anterior', fmt(lastMonth));
  if (diff !== null) {
    const sign = diff >= 0 ? '+' : '';
    row('Variação', `${sign}${diff.toFixed(1)}%`, false, diff >= 0 ? [21,128,61] : [220,38,38]);
  }

  // Ordens
  section('Ordens de Serviço');
  row('Total de OS', String(dashboard?.orders?.total ?? 0));
  row('Abertas', String(dashboard?.orders?.open ?? 0));
  row('Em Andamento', String(dashboard?.orders?.inProgress ?? 0));
  row('Finalizadas', String(dashboard?.orders?.finished ?? 0));
  row('Entregues', String(dashboard?.orders?.delivered ?? 0));

  // Status
  if (byStatus.length > 0) {
    section('Distribuição por Status');
    byStatus.forEach(s => row(s.label, `${s.count} OS`));
  }

  // Clientes
  section('Clientes');
  row('Clientes atendidos no mês', String(dashboard?.customersThisMonth ?? 0), true);
  row('Total de clientes ativos', String(dashboard?.totalCustomers ?? 0));

  // Rodapé
  text('Página 1 de 1', W/2, H-5, { size: 7, color: [180,180,180], align: 'center' });

  pdf.save(`Relatorio-Mensal-${mesLabel.replace(' ','-')}.pdf`);
}

// ── Gerador PDF anual ─────────────────────────────────────────────────────────
async function gerarPdfAnual(
  year: number,
  monthlyRevenue: MonthlyRevenue[],
  byStatus: StatusCount[],
  topCustomers: TopCustomer[],
) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const L = 14, R = W - 14;
  let y = 0;

  const now = new Date();
  const nl = (n = 5) => { y += n; };
  const text = (t: string, x: number, yy: number,
    opts: { size?: number; bold?: boolean; color?: [number,number,number]; align?: 'left'|'right'|'center' } = {}) => {
    pdf.setFontSize(opts.size ?? 10);
    pdf.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    if (opts.color) pdf.setTextColor(...opts.color); else pdf.setTextColor(0,0,0);
    pdf.text(t, x, yy, { align: opts.align ?? 'left' });
    pdf.setTextColor(0,0,0);
  };
  const hline = (yy = y, color = [200,200,200] as [number,number,number]) => {
    pdf.setDrawColor(...color); pdf.line(L, yy, R, yy); pdf.setDrawColor(0,0,0);
  };
  const section = (title: string) => {
    nl(5);
    pdf.setFillColor(245,245,245);
    pdf.rect(L, y, R-L, 6, 'F');
    text(title.toUpperCase(), L+2, y+4.3, { size: 7.5, bold: true, color: [90,90,90] });
    y += 6; nl(4);
  };
  const row = (label: string, value: string, bold = false, color?: [number,number,number]) => {
    text(label, L, y, { size: 10, bold, color: color ?? (bold ? [0,0,0] : [90,90,90]) });
    text(value, R, y, { size: 10, bold, align: 'right', color: color ?? [0,0,0] });
    nl(bold ? 7 : 6);
  };

  // Cabeçalho
  y = 18;
  text('ARC SOLUÇÕES INDUSTRIAIS', L, y, { size: 16, bold: true });
  nl(7);
  text(`Relatório Anual — ${year}`, L, y, { size: 11, color: [70,70,70] });
  nl(5);
  text(`Emitido em ${now.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })}`, L, y, { size: 8, color: [150,150,150] });
  nl(5);
  pdf.setLineWidth(0.5); hline(y, [0,0,0]); pdf.setLineWidth(0.2);

  // Faturamento mensal
  section('Faturamento por Mês');

  // Cabeçalho da tabela
  const colClientes = L + 110;
  text('Mês', L, y, { size: 8, bold: true, color: [100,100,100] });
  text('Clientes', colClientes, y, { size: 8, bold: true, color: [100,100,100], align: 'right' });
  text('Faturamento', R, y, { size: 8, bold: true, color: [100,100,100], align: 'right' });
  nl(3); hline(y, [180,180,180]); nl(4);

  let totalAnual = 0;
  let totalClientesAnuais = 0;
  monthlyRevenue.forEach((m) => {
    const hasRevenue = m.revenue > 0 || m.customersCount > 0;
    text(MONTHS_PT[m.month - 1], L, y, { size: 9, color: hasRevenue ? [50,50,50] : [180,180,180] });
    text(
      m.customersCount > 0 ? String(m.customersCount) : '—',
      colClientes, y,
      { size: 9, align: 'right', color: m.customersCount > 0 ? [0,0,0] : [180,180,180] }
    );
    text(fmt(m.revenue), R, y, {
      size: 9,
      align: 'right',
      color: m.revenue > 0 ? [0,0,0] : [180,180,180],
    });
    nl(5.5);
    totalAnual += m.revenue;
    totalClientesAnuais += m.customersCount ?? 0;
  });

  nl(1); hline(y, [0,0,0]); nl(5);
  text('Total Anual', L, y, { size: 11, bold: true });
  text(`${totalClientesAnuais} atend.`, colClientes, y, { size: 10, align: 'right', color: [80,80,80] });
  text(fmt(totalAnual), R, y, { size: 11, bold: true, align: 'right' });
  nl(8);

  // OS por status
  if (byStatus.length > 0) {
    section('Distribuição por Status');
    byStatus.forEach(s => row(s.label, `${s.count} OS`));
  }

  // Top clientes
  if (topCustomers.length > 0) {
    section('Clientes Mais Frequentes');
    topCustomers.slice(0, 10).forEach((c, i) => {
      text(`${i + 1}. ${c.name}`, L, y, { size: 9, color: [50,50,50] });
      text(`${c.count} OS`, R, y, { size: 9, align: 'right', color: [100,100,100] });
      nl(5.5);
    });
  }

  // Rodapé
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    text(`Página ${i} de ${totalPages}`, W/2, H-5, { size: 7, color: [180,180,180], align: 'center' });
  }

  pdf.save(`Relatorio-Anual-${year}.pdf`);
}

// ── Gerador PDF de Faturamento por Cliente ────────────────────────────────────
async function gerarPdfFaturamento(orders: BillingOrder[], customerName: string, monthLabel: string, pixKey?: string) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const L = 14, R = W - 14;
  let y = 0;
  let page = 1;

  const now = new Date();

  const nl = (n = 5) => { y += n; };

  const text = (t: string, x: number, yy: number,
    opts: { size?: number; bold?: boolean; color?: [number,number,number]; align?: 'left'|'right'|'center' } = {}) => {
    pdf.setFontSize(opts.size ?? 9);
    pdf.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    if (opts.color) pdf.setTextColor(...opts.color); else pdf.setTextColor(0,0,0);
    pdf.text(t, x, yy, { align: opts.align ?? 'left' });
    pdf.setTextColor(0,0,0);
  };

  const hline = (yy = y, color = [200,200,200] as [number,number,number], width = 0.2) => {
    pdf.setLineWidth(width);
    pdf.setDrawColor(...color);
    pdf.line(L, yy, R, yy);
    pdf.setDrawColor(0,0,0);
    pdf.setLineWidth(0.2);
  };

  const checkPage = (needed = 20) => {
    if (y + needed > H - 15) {
      pdf.addPage();
      page++;
      y = 14;
    }
  };

  // Bloco de texto livre (rótulo + conteúdo com quebra automática de linha).
  // Não renderiza nada se o campo estiver vazio.
  const textBlock = (label: string, value?: string | null) => {
    const content = (value ?? '').trim();
    if (!content) return;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    const lines: string[] = pdf.splitTextToSize(content, R - L - 5);
    checkPage(5 + lines.length * 4);
    text(label, L + 2, y, { size: 7, bold: true, color: [80,80,80] });
    nl(4);
    for (const line of lines) {
      checkPage(5);
      text(line, L + 3, y, { size: 8, color: [50,50,50] });
      nl(4);
    }
    nl(1.5);
  };

  // Cabeçalho
  y = 16;
  text('ARC SOLUÇÕES INDUSTRIAIS', L, y, { size: 15, bold: true });
  nl(7);
  text(`Faturamento — ${customerName}`, L, y, { size: 11, color: [50,50,50] });
  nl(5);
  text(`Período: ${monthLabel}`, L, y, { size: 9, color: [100,100,100] });
  nl(4);
  text(`Emitido em ${now.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })}`, L, y, { size: 8, color: [150,150,150] });
  nl(4);
  pdf.setLineWidth(0.5); hline(y, [0,0,0], 0.5); pdf.setLineWidth(0.2);
  nl(6);

  let grandTotal = 0;
  let totalPaid = 0;

  for (const order of orders) {
    const t = order.totals;
    grandTotal += t.grandTotal;
    totalPaid += t.totalPaid;

    // Mantém a OS junta; se não couber inteira, começa em página nova.
    checkPage(46);
    const blockStartY = y;
    const blockStartPage = page;
    const RR = R - 3; // margem interna direita do cartão

    // Faixa de topo da OS: número + data
    pdf.setFillColor(245, 245, 245);
    pdf.rect(L, y, R - L, 6, 'F');
    text(`OS #${order.orderNumber}`, L + 3, y + 4, { size: 8.5, bold: true });
    text(new Date(order.entryDate).toLocaleDateString('pt-BR'), RR, y + 4, { size: 8, color: [100,100,100], align: 'right' });
    y += 6;
    nl(4.5);

    // Descrições — só as que foram preenchidas na OS
    textBlock('Equipamento', order.equipment);
    textBlock('Problema Relatado', order.problemReported);
    textBlock('Serviço Realizado', order.serviceDone);

    // Valores detalhados — só o que existe na OS
    // Peças
    if (order.orderParts?.length > 0) {
      checkPage(8 + order.orderParts.length * 5);
      text('Peças', L + 3, y, { size: 7, bold: true, color: [80,80,80] });
      nl(4);
      hline(y, [225,225,225]);
      nl(3.5);
      for (const p of order.orderParts) {
        checkPage(6);
        text(p.partName, L + 4, y, { size: 8 });
        text(`${p.quantity}×`, L + 96, y, { size: 8, align: 'right', color: [100,100,100] });
        text(fmt(p.unitPrice), L + 128, y, { size: 8, align: 'right', color: [100,100,100] });
        text(fmt(p.totalPrice), RR, y, { size: 8, bold: true, align: 'right' });
        nl(5);
      }
    }

    // Mão de obra
    if (order.workHours?.length > 0) {
      checkPage(8 + order.workHours.length * 5);
      text('Mão de Obra', L + 3, y, { size: 7, bold: true, color: [80,80,80] });
      nl(4);
      hline(y, [225,225,225]);
      nl(3.5);
      for (const h of order.workHours) {
        checkPage(6);
        text(h.description || 'Serviço', L + 4, y, { size: 8 });
        text(`${h.hours}h`, L + 96, y, { size: 8, align: 'right', color: [100,100,100] });
        text(fmt(h.hourlyRate), L + 128, y, { size: 8, align: 'right', color: [100,100,100] });
        text(fmt(h.totalCost), RR, y, { size: 8, bold: true, align: 'right' });
        nl(5);
      }
    }

    // Custos adicionais
    if (order.additionalCosts?.length > 0) {
      checkPage(8 + order.additionalCosts.length * 5);
      text('Custos Adicionais', L + 3, y, { size: 7, bold: true, color: [80,80,80] });
      nl(4);
      hline(y, [225,225,225]);
      nl(3.5);
      for (const c of order.additionalCosts) {
        checkPage(6);
        text(c.description, L + 4, y, { size: 8 });
        text(fmt(c.amount), RR, y, { size: 8, bold: true, align: 'right' });
        nl(5);
      }
    }

    // Deslocamento / viagem — km rodados e horas de viagem, com suas taxas
    if (t.travelTotal > 0) {
      checkPage(18);
      text('Deslocamento', L + 3, y, { size: 7, bold: true, color: [80,80,80] });
      nl(4);
      hline(y, [225,225,225]);
      nl(3.5);
      if (t.travelKmTotal > 0) {
        checkPage(6);
        text('Quilometragem', L + 4, y, { size: 8 });
        text(`${num(order.travelKm)} km`, L + 96, y, { size: 8, align: 'right', color: [100,100,100] });
        text(fmt(order.travelKmRate), L + 128, y, { size: 8, align: 'right', color: [100,100,100] });
        text(fmt(t.travelKmTotal), RR, y, { size: 8, bold: true, align: 'right' });
        nl(5);
      }
      if (t.travelHourTotal > 0) {
        checkPage(6);
        text('Horas de viagem', L + 4, y, { size: 8 });
        text(`${num(order.travelHours)}h`, L + 96, y, { size: 8, align: 'right', color: [100,100,100] });
        text(fmt(order.travelHourRate), L + 128, y, { size: 8, align: 'right', color: [100,100,100] });
        text(fmt(t.travelHourTotal), RR, y, { size: 8, bold: true, align: 'right' });
        nl(5);
      }
    }

    // Valor final da OS
    checkPage(10);
    nl(1);
    hline(y, [180,180,180]);
    nl(4.5);
    text('Total da OS', L + 3, y, { size: 9, bold: true });
    text(fmt(t.grandTotal), RR, y, { size: 9, bold: true, align: 'right' });
    nl(5);

    // Contorno do cartão — só quando a OS coube inteira na página
    if (page === blockStartPage) {
      pdf.setLineWidth(0.3);
      pdf.setDrawColor(220, 220, 220);
      pdf.roundedRect(L, blockStartY, R - L, y - blockStartY, 2, 2, 'S');
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.2);
    }
    nl(7);
  }

  // Total geral
  checkPage(18);
  pdf.setLineWidth(0.5); hline(y, [0,0,0], 0.5); pdf.setLineWidth(0.2);
  nl(6);
  text('TOTAL GERAL', L, y, { size: 13, bold: true });
  text(fmt(grandTotal), R, y, { size: 13, bold: true, align: 'right' });

  // Pagamentos recebidos e saldo em aberto
  if (totalPaid > 0) {
    const remaining = grandTotal - totalPaid;
    checkPage(14);
    nl(6);
    text('Pago', L, y, { size: 9, color: [100,100,100] });
    text(fmt(totalPaid), R, y, { size: 9, align: 'right', color: [21, 128, 61] });
    nl(5);
    text('Saldo a Pagar', L, y, { size: 10, bold: true });
    text(fmt(remaining), R, y, {
      size: 10, bold: true, align: 'right',
      color: remaining > 0 ? [185, 28, 28] : [21, 128, 61],
    });
  }

  // PIX
  if (pixKey) {
    checkPage(22);
    nl(4);
    pdf.setFillColor(236, 253, 245);
    pdf.setDrawColor(110, 231, 183);
    pdf.roundedRect(L, y, R - L, 16, 3, 3, 'FD');
    text('PIX PARA PAGAMENTO', L + 5, y + 5, { size: 7, bold: true, color: [6, 95, 70] });
    text(pixKey, L + 5, y + 11, { size: 11, bold: true, color: [6, 78, 59] });
    y += 16;
    pdf.setDrawColor(0, 0, 0);
  }

  // Rodapé em todas as páginas
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    text(`Página ${i} de ${totalPages}`, W / 2, H - 5, { size: 7, color: [180,180,180], align: 'center' });
  }

  pdf.save(`Faturamento-${customerName.replace(/\s+/g, '-')}-${monthLabel.replace(/\s+/g, '-')}.pdf`);
}

// ── Componentes ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, trend }: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5 flex gap-3 sm:gap-4 items-start">
      <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 text-primary shrink-0">
        <Icon className="size-4 sm:size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl sm:text-2xl font-bold">{value}</p>
        {sub && (
          <p className={`text-xs flex items-center gap-1 mt-0.5 ${
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
          }`}>
            {trend === 'up' && <TrendingUp className="size-3" />}
            {trend === 'down' && <TrendingDown className="size-3" />}
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

function BillingSection() {
  const currentDate = new Date();
  const [customerId, setCustomerId] = useState('');
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [queryKey, setQueryKey] = useState<null | { customerId: string; month: number; year: number }>(null);

  const { data: customers = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['customers-billing'],
    queryFn: () => api.get('/customers').then(r => r.data),
  });

  const { data: userProfile } = useQuery<{ pixKey?: string }>({
    queryKey: ['users-me-billing'],
    queryFn: () => api.get('/users/me').then(r => r.data),
  });

  const { data: orders = [], isFetching } = useQuery<BillingOrder[]>({
    queryKey: ['billing-report', queryKey],
    queryFn: () => {
      if (!queryKey) return [];
      const startDate = new Date(queryKey.year, queryKey.month - 1, 1).toISOString();
      const endDate   = new Date(queryKey.year, queryKey.month, 0, 23, 59, 59).toISOString();
      return api.get('/service-orders/billing-report', {
        params: { customerId: queryKey.customerId, startDate, endDate },
      }).then(r => r.data);
    },
    enabled: !!queryKey,
  });

  const grandTotal = orders.reduce((s, o) => s + o.totals.grandTotal, 0);
  const totalPaid = orders.reduce((s, o) => s + o.totals.totalPaid, 0);
  const remaining = grandTotal - totalPaid;

  const selectedCustomer = customers.find(c => c.id === customerId);
  const monthLabel = `${MONTHS_PT[month - 1]} ${year}`;

  function handleSearch() {
    if (!customerId) return;
    setQueryKey({ customerId, month, year });
  }

  async function handlePdf() {
    if (!orders.length || !selectedCustomer) return;
    setLoadingPdf(true);
    try { await gerarPdfFaturamento(orders, selectedCustomer.name, monthLabel, userProfile?.pixKey); }
    finally { setLoadingPdf(false); }
  }

  const inputClass = 'rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors';

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-muted/20">
        <FileText className="size-4 text-muted-foreground" />
        <h2 className="font-semibold text-sm">Faturamento por Cliente</h2>
      </div>

      <div className="p-5 space-y-4">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            className={`${inputClass} flex-1`}
            value={customerId}
            onChange={e => setCustomerId(e.target.value)}
          >
            <option value="">Selecione um cliente...</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            className={`${inputClass} w-full sm:w-40`}
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
          >
            {MONTHS_PT.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>

          <select
            className={`${inputClass} w-full sm:w-28`}
            value={year}
            onChange={e => setYear(Number(e.target.value))}
          >
            {[currentDate.getFullYear(), currentDate.getFullYear() - 1, currentDate.getFullYear() - 2].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <Button onClick={handleSearch} disabled={!customerId || isFetching} className="shrink-0">
            <Search className="size-4" />
            Buscar
          </Button>
        </div>

        {/* Resultado */}
        {isFetching && (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isFetching && queryKey && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <FileText className="size-8 mb-2 opacity-25" />
            <p className="text-sm">Nenhuma OS encontrada para este cliente no período</p>
          </div>
        )}

        {!isFetching && orders.length > 0 && (
          <>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">OS</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Equipamento</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Entrada</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map(o => (
                    <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">#{o.orderNumber}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{o.equipment || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{fmtDate(o.entryDate)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmt(o.totals.grandTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3 border border-border">
                <div>
                  <p className="text-xs text-muted-foreground">{orders.length} OS · {monthLabel}</p>
                  <p className="text-lg font-bold">Total: {fmt(grandTotal)}</p>
                  {totalPaid > 0 && (
                    <p className="text-xs mt-0.5">
                      <span className="text-green-600">Pago {fmt(totalPaid)}</span>
                      <span className="text-muted-foreground"> · </span>
                      <span className={remaining > 0 ? 'text-red-500' : 'text-green-600'}>
                        Saldo {fmt(remaining)}
                      </span>
                    </p>
                  )}
                </div>
                <Button onClick={handlePdf} disabled={loadingPdf} variant="outline">
                  <Download className="size-4" />
                  {loadingPdf ? 'Gerando...' : 'Gerar PDF'}
                </Button>
              </div>

              {userProfile?.pixKey && (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                    PIX
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-emerald-700 font-medium">Chave PIX para pagamento</p>
                    <p className="font-mono font-semibold text-emerald-900 break-all">{userProfile.pixKey}</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function RelatoriosPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [loadingMensal, setLoadingMensal] = useState(false);
  const [loadingAnual, setLoadingAnual] = useState(false);

  const { data: dashboard } = useQuery<DashboardReport>({
    queryKey: ['reports-dashboard'],
    queryFn: () => api.get('/reports/dashboard').then(r => r.data),
  });

  const { data: monthlyRevenue = [] } = useQuery<MonthlyRevenue[]>({
    queryKey: ['reports-monthly', year],
    queryFn: () => api.get('/reports/monthly-revenue', { params: { year } }).then(r => r.data),
  });

  const { data: byStatus = [] } = useQuery<StatusCount[]>({
    queryKey: ['reports-status'],
    queryFn: () => api.get('/reports/orders-by-status').then(r => r.data),
  });

  const { data: topCustomers = [] } = useQuery<TopCustomer[]>({
    queryKey: ['reports-customers'],
    queryFn: () => api.get('/reports/top-customers').then(r => r.data),
  });

  const thisMonth = dashboard?.revenue?.thisMonth ?? 0;
  const lastMonth = dashboard?.revenue?.lastMonth ?? 0;
  const revenueChange = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : null;

  const chartData = monthlyRevenue.map(m => ({ ...m, shortLabel: m.label.slice(0, 3) }));

  async function handlePdfMensal() {
    if (!dashboard) return;
    setLoadingMensal(true);
    try { await gerarPdfMensal(dashboard, byStatus); }
    finally { setLoadingMensal(false); }
  }

  async function handlePdfAnual() {
    if (!monthlyRevenue.length) return;
    setLoadingAnual(true);
    try { await gerarPdfAnual(year, monthlyRevenue, byStatus, topCustomers); }
    finally { setLoadingAnual(false); }
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Visão financeira e operacional do sistema</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePdfMensal}
            disabled={loadingMensal || !dashboard}
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">{loadingMensal ? 'Gerando...' : 'PDF Mensal'}</span>
            <span className="sm:hidden">{loadingMensal ? '...' : 'Mensal'}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePdfAnual}
            disabled={loadingAnual || !monthlyRevenue.length}
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">{loadingAnual ? 'Gerando...' : `PDF Anual ${year}`}</span>
            <span className="sm:hidden">{loadingAnual ? '...' : `Anual ${year}`}</span>
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Faturamento do Mês"
          value={fmt(thisMonth)}
          icon={DollarSign}
          sub={
            revenueChange !== null
              ? `${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}% vs mês ant.`
              : 'Primeiro mês'
          }
          trend={revenueChange === null ? 'neutral' : revenueChange >= 0 ? 'up' : 'down'}
        />
        <StatCard
          label="Total de OS"
          value={String(dashboard?.orders?.total ?? 0)}
          icon={ClipboardList}
          sub={`${dashboard?.orders?.open ?? 0} abertas`}
          trend="neutral"
        />
        <StatCard
          label="Clientes"
          value={String(dashboard?.totalCustomers ?? 0)}
          icon={Users}
          trend="neutral"
        />
        <StatCard
          label="Mês Anterior"
          value={fmt(lastMonth)}
          icon={DollarSign}
          trend="neutral"
        />
      </div>

      {/* Gráfico de faturamento mensal */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="font-medium text-sm sm:text-base">Faturamento Mensal</h2>
          <div className="flex items-center gap-2">
            <select
              className="text-sm border border-input rounded-lg px-2 py-1 bg-background outline-none"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
            >
              {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="h-45 sm:h-55">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="shortLabel"
                tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={v => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <Tooltip
                formatter={(v) => [fmt(Number(v ?? 0)), 'Faturamento']}
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
      </div>

      {/* Faturamento por cliente */}
      <BillingSection />

      {/* OS por status + Top clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
          <h2 className="font-medium text-sm sm:text-base mb-4 sm:mb-6">OS por Status</h2>
          {byStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados</p>
          ) : (
            <div className="h-50 sm:h-55">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byStatus}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="45%"
                    outerRadius="60%"
                  >
                    {byStatus.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend formatter={(v) => <span style={{ fontSize: 12 }}>{v}</span>} />
                  <Tooltip
                    formatter={(v) => [Number(v ?? 0), 'OS']}
                    contentStyle={{
                      background: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
          <h2 className="font-medium text-sm sm:text-base mb-4">Clientes Mais Frequentes</h2>
          {topCustomers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados</p>
          ) : (
            <div className="space-y-3">
              {topCustomers.slice(0, 8).map((c, i) => (
                <div key={c.customerId} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{c.count} OS</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(c.count / (topCustomers[0]?.count || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
