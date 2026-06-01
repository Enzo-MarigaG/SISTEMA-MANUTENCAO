'use client';

import { use, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

async function gerarPdf(order: any, summary: any) {
  const { jsPDF } = await import('jspdf');

  const pdf = new jsPDF('p', 'mm', 'a4');
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const L = 12;
  const R = W - 12;
  let y = 0;

  const nl = (n = 4) => { y += n; };

  const line = (x1: number, y1: number, x2: number, y2: number) => pdf.line(x1, y1, x2, y2);
  const hline = (yy = y, color = [220, 220, 220] as [number, number, number]) => {
    pdf.setDrawColor(...color); line(L, yy, R, yy); pdf.setDrawColor(0, 0, 0);
  };

  const text = (
    t: string, x: number, yy: number,
    opts: { size?: number; bold?: boolean; color?: [number, number, number]; align?: 'left' | 'right' | 'center' } = {}
  ) => {
    pdf.setFontSize(opts.size ?? 9);
    pdf.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    if (opts.color) pdf.setTextColor(...opts.color); else pdf.setTextColor(0, 0, 0);
    pdf.text(t, x, yy, { align: opts.align ?? 'left' });
    pdf.setTextColor(0, 0, 0);
  };

  const sectionTitle = (title: string) => {
    nl(3);
    pdf.setFillColor(245, 245, 245);
    pdf.rect(L, y, R - L, 5.5, 'F');
    text(title.toUpperCase(), L + 2, y + 4, { size: 7, bold: true, color: [100, 100, 100] });
    y += 5.5;
  };

  const fieldRow = (label: string, value: string, x = L) => {
    text(label, x, y, { size: 7, color: [130, 130, 130] });
    nl(3.5);
    text(value || '—', x, y, { size: 9 });
    nl(5);
  };

  const mid = L + (R - L) / 2 + 2;

  // ── Cabeçalho ─────────────────────────────────────────────────────────────
  y = 14;
  text('ARC SOLUÇÕES INDUSTRIAIS', L, y, { size: 15, bold: true });
  nl(6);
  text(`Ordem de Serviço ${order.orderNumber}`, L, y, { size: 10, color: [80, 80, 80] });
  nl(5);
  text(
    `Emitido em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`,
    L, y, { size: 8, color: [150, 150, 150] }
  );
  nl(4);
  pdf.setDrawColor(0, 0, 0); pdf.setLineWidth(0.5); hline(y, [0, 0, 0]); pdf.setLineWidth(0.2);
  nl(5);

  // ── Cliente ───────────────────────────────────────────────────────────────
  sectionTitle('Informações do Cliente');
  nl(4);

  fieldRow('Nome', order.customer.name);

  if (order.customer.phone || order.customer.email) {
    const rowY = y;
    if (order.customer.phone) {
      text('Telefone', L, rowY, { size: 7, color: [130, 130, 130] });
      text(order.customer.phone, L, rowY + 3.5, { size: 9 });
    }
    if (order.customer.email) {
      text('E-mail', mid, rowY, { size: 7, color: [130, 130, 130] });
      text(order.customer.email, mid, rowY + 3.5, { size: 9 });
    }
    y = rowY + 8.5;
  }

  if (order.customer.address) fieldRow('Endereço', order.customer.address);

  // ── OS ────────────────────────────────────────────────────────────────────
  sectionTitle('Informações da OS');
  nl(4);

  if (order.equipment) fieldRow('Equipamento', order.equipment);

  {
    const rowY = y;
    text('Data de Início', L, rowY, { size: 7, color: [130, 130, 130] });
    text(fmtDate(order.entryDate), L, rowY + 3.5, { size: 9 });
    if (order.exitDate) {
      text('Data de Encerramento', mid, rowY, { size: 7, color: [130, 130, 130] });
      text(fmtDate(order.exitDate), mid, rowY + 3.5, { size: 9 });
    }
    y = rowY + 8.5;
  }

  // ── Problema / Serviço ─────────────────────────────────────────────────────
  sectionTitle('Problema Relatado');
  nl(4);
  pdf.splitTextToSize(order.problemReported || '—', R - L - 4)
    .slice(0, 5)
    .forEach((l: string) => { text(l, L, y, { size: 9 }); nl(4.5); });

  sectionTitle('Serviço Realizado');
  nl(4);
  pdf.splitTextToSize(order.serviceDone || 'Não preenchido', R - L - 4)
    .slice(0, 5)
    .forEach((l: string) => {
      text(l, L, y, { size: 9, color: order.serviceDone ? [0, 0, 0] : [150, 150, 150] });
      nl(4.5);
    });

  if (order.observations) {
    sectionTitle('Observações');
    nl(4);
    pdf.splitTextToSize(order.observations, R - L - 4)
      .slice(0, 3)
      .forEach((l: string) => { text(l, L, y, { size: 9 }); nl(4.5); });
  }

  // ── Peças ──────────────────────────────────────────────────────────────────
  if (order.orderParts?.length > 0) {
    sectionTitle('Peças Utilizadas');
    nl(4);
    text('Peça', L, y, { size: 7, bold: true, color: [100, 100, 100] });
    text('Qtd', L + 90, y, { size: 7, bold: true, color: [100, 100, 100], align: 'right' });
    text('Unitário', L + 122, y, { size: 7, bold: true, color: [100, 100, 100], align: 'right' });
    text('Total', R, y, { size: 7, bold: true, color: [100, 100, 100], align: 'right' });
    nl(2.5); hline(); nl(3.5);
    order.orderParts.forEach((p: any) => {
      const name = pdf.splitTextToSize(p.partName, 80)[0];
      text(name, L, y, { size: 9 });
      text(String(p.quantity), L + 90, y, { size: 9, align: 'right' });
      text(fmt(p.unitPrice), L + 122, y, { size: 9, align: 'right' });
      text(fmt(p.totalPrice), R, y, { size: 9, bold: true, align: 'right' });
      nl(5);
    });
  }

  // ── Horas ─────────────────────────────────────────────────────────────────
  if (order.workHours?.length > 0) {
    sectionTitle('Mão de Obra');
    nl(4);
    text('Data', L, y, { size: 7, bold: true, color: [100, 100, 100] });
    text('Descrição', L + 25, y, { size: 7, bold: true, color: [100, 100, 100] });
    text('Horas', L + 105, y, { size: 7, bold: true, color: [100, 100, 100], align: 'right' });
    text('Valor/h', L + 135, y, { size: 7, bold: true, color: [100, 100, 100], align: 'right' });
    text('Total', R, y, { size: 7, bold: true, color: [100, 100, 100], align: 'right' });
    nl(2.5); hline(); nl(3.5);
    order.workHours.forEach((wh: any) => {
      text(fmtDate(wh.workedDate), L, y, { size: 8 });
      const desc = pdf.splitTextToSize(wh.description || '—', 75)[0];
      text(desc, L + 25, y, { size: 8, color: [120, 120, 120] });
      text(`${wh.hours}h`, L + 105, y, { size: 8, align: 'right' });
      text(fmt(wh.hourlyRate), L + 135, y, { size: 8, align: 'right' });
      text(fmt(wh.totalCost), R, y, { size: 8, bold: true, align: 'right' });
      nl(5);
    });
  }

  // ── Custos adicionais ──────────────────────────────────────────────────────
  if (order.additionalCosts?.length > 0) {
    sectionTitle('Custos Adicionais');
    nl(4);
    text('Descrição', L, y, { size: 7, bold: true, color: [100, 100, 100] });
    text('Valor', R, y, { size: 7, bold: true, color: [100, 100, 100], align: 'right' });
    nl(2.5); hline(); nl(3.5);
    order.additionalCosts.forEach((c: any) => {
      text(c.description, L, y, { size: 9 });
      text(fmt(c.amount), R, y, { size: 9, bold: true, align: 'right' });
      nl(5);
    });
  }

  // ── Resumo financeiro ──────────────────────────────────────────────────────
  sectionTitle('Resumo Financeiro');
  nl(4);
  const sumRow = (label: string, value: number, bold = false, color?: [number, number, number]) => {
    text(label, L, y, { size: bold ? 10 : 9, bold, color: color ?? (bold ? [0, 0, 0] : [100, 100, 100]) });
    text(fmt(value), R, y, { size: bold ? 10 : 9, bold, align: 'right', color: color ?? [0, 0, 0] });
    nl(bold ? 6 : 5);
  };
  if (summary.partsTotal > 0) sumRow('Peças', summary.partsTotal);
  if (summary.hoursTotal > 0) sumRow('Mão de Obra', summary.hoursTotal);
  if (summary.costsTotal > 0) sumRow('Custos Adicionais', summary.costsTotal);
  hline(y, [0, 0, 0]); nl(4);
  sumRow('Total Geral', summary.grandTotal, true);
  if (summary.totalPaid > 0) sumRow('Pago', summary.totalPaid, false, [21, 128, 61]);
  if (summary.remaining > 0) sumRow('Saldo Pendente', summary.remaining, true, [220, 38, 38]);

  // ── PIX fixo ───────────────────────────────────────────────────────────────
  nl(3);
  pdf.setFillColor(236, 253, 245);
  pdf.setDrawColor(110, 231, 183);
  pdf.roundedRect(L, y, R - L, 16, 3, 3, 'FD');
  text('PIX PARA PAGAMENTO', L + 5, y + 5, { size: 7, bold: true, color: [6, 95, 70] });
  text('Pix CNPJ 45782730000120', L + 5, y + 11, { size: 11, bold: true, color: [6, 78, 59] });
  y += 16;
  pdf.setDrawColor(0, 0, 0);

  // ── Rodapé ─────────────────────────────────────────────────────────────────
  text('Página 1 de 1', W / 2, H - 5, { size: 7, color: [180, 180, 180], align: 'center' });

  pdf.save(`OS-${order.orderNumber}.pdf`);
}

export default function OsPdfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [status, setStatus] = useState<'loading' | 'generating' | 'done' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const { data: order } = useQuery<any>({
    queryKey: ['pdf-order', id],
    queryFn: () => api.get(`/service-orders/${id}`).then(r => r.data),
  });

  const { data: summary } = useQuery<any>({
    queryKey: ['pdf-summary', id],
    queryFn: () => api.get(`/service-orders/${id}/summary`).then(r => r.data),
    enabled: !!order,
  });

  const generate = async () => {
    if (!order || !summary) return;
    setStatus('generating');
    try {
      await gerarPdf(order, summary);
      setStatus('done');
    } catch (err: any) {
      console.error('Erro ao gerar PDF:', err);
      setErrorMsg(err?.message ?? 'Erro desconhecido');
      setStatus('error');
    }
  };

  useEffect(() => {
    if (order && summary) generate();
  }, [order, summary]); // eslint-disable-line

  const styles: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', fontFamily: 'system-ui, sans-serif', padding: 24 },
    card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 32, maxWidth: 420, width: '100%', textAlign: 'center' as const },
    title: { fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#111' },
    sub: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
    btn: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none' },
    btnPrimary: { background: '#111', color: '#fff' },
    btnOutline: { background: 'transparent', border: '1px solid #d1d5db', color: '#374151' },
    spinner: { width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#111', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' },
  };

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={styles.page}>
        <div style={styles.card}>

          {(status === 'loading' || status === 'generating') && (
            <>
              <div style={styles.spinner} />
              <p style={styles.title}>{status === 'loading' ? 'Carregando dados...' : 'Gerando PDF...'}</p>
              <p style={styles.sub}>Aguarde um momento</p>
            </>
          )}

          {status === 'done' && (
            <>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <p style={styles.title}>PDF gerado com sucesso!</p>
              <p style={styles.sub}>O arquivo foi baixado para o seu dispositivo.</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={generate}>
                  Baixar novamente
                </button>
                <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => window.close()}>
                  Fechar
                </button>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
              <p style={styles.title}>Erro ao gerar PDF</p>
              <p style={styles.sub}>{errorMsg || 'Verifique o console para mais detalhes.'}</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={generate}>
                  Tentar novamente
                </button>
                <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => window.close()}>
                  Fechar
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}
