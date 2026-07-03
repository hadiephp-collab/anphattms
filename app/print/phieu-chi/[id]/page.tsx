'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { transactionsApi } from '@/lib/transactions';
import { settingsApi, StoreSetting } from '@/lib/settings';
import { renderTemplate, numberToWords, localDateStr, localDateTimeStr, PM_LABEL, TemplateVars } from '@/lib/template-engine';
import { DEFAULT_TEMPLATE_PHIEU_CHI } from '@/lib/default-templates';

interface Tx {
  id: number; code: string; type: string;
  amount: number; paymentMethod: string; category: string | null;
  note: string | null; date: string | null; createdAt: string;
  partner?: { id: number; name: string } | null;
  branchEntity?: { id: number; name: string } | null;
  createdBy?: { id: number; fullName: string } | null;
  order?: { id: number; code: string } | null;
}

function buildVars(tx: Tx, s: StoreSetting | null): TemplateVars {
  const fmt = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
  const txDate = tx.date || tx.createdAt;
  const reason = tx.category || tx.note || '—';
  const notes = tx.category && tx.note ? tx.note : '';

  return {
    store_name: s?.storeName || 'An Phát TMS',
    store_address: s?.storeAddress || '',
    store_phone: s?.storePhone || '',
    store_email: s?.storeEmail || '',
    store_tax_code: s?.taxCode || '',
    print_footer: s?.printFooter || '',
    print_date: localDateTimeStr(),
    tx_code: tx.code,
    tx_date: localDateStr(new Date(txDate)),
    partner_name: tx.partner?.name || '—',
    amount: fmt(Number(tx.amount)),
    amount_text: numberToWords(Math.round(Number(tx.amount))),
    reason,
    notes,
    linked_order: tx.order?.code || '',
    payment_method: PM_LABEL[tx.paymentMethod] || tx.paymentMethod,
    branch_name: tx.branchEntity?.name || '',
    staff_name: tx.createdBy?.fullName || '',
  };
}

export default function PrintPhieuChiPage() {
  const { id } = useParams<{ id: string }>();
  const [html, setHtml] = useState('');
  const [paperSize, setPaperSize] = useState('A4');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      transactionsApi.getOne(Number(id)).catch(() => null),
      settingsApi.get().catch(() => null),
    ]).then(([tx, settings]) => {
      if (!tx) { setError('Không tìm thấy phiếu chi'); setReady(true); return; }
      const template = settings?.templatePhieuChi || DEFAULT_TEMPLATE_PHIEU_CHI;
      const pSize = settings?.paperSizePhieuChi || 'A4';
      setPaperSize(pSize);
      setHtml(renderTemplate(template, buildVars(tx as Tx, settings)));
      setReady(true);
    });
  }, [id]);

  useEffect(() => {
    if (ready && html) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [ready, html]);

  if (!ready) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial', color: '#999', fontSize: 14 }}>Đang tải...</div>;
  if (error) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial', color: '#f00', fontSize: 14 }}>{error}</div>;

  const maxWidth = paperSize === 'A5' ? 540 : 740;

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#000', background: '#fff', minHeight: '100vh' }}>
      <style>{`@media print{.no-print{display:none!important}.print-wrap{padding-top:0!important}@page{size:${paperSize} portrait;margin:12mm 15mm}}`}</style>
      <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: '#1a1d2e', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 100 }}>
        <button onClick={() => window.print()} style={{ padding: '6px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>🖨 In ngay</button>
        <button onClick={() => window.close()} style={{ padding: '6px 16px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>✕ Đóng</button>
        <span style={{ color: '#9ca3af', fontSize: 12 }}>Ctrl+P để in thủ công</span>
      </div>
      <div className="print-wrap" style={{ maxWidth, margin: '0 auto', padding: '52px 20px 32px' }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
