'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { purchaseOrdersApi } from '@/lib/purchase-orders';
import { settingsApi, StoreSetting } from '@/lib/settings';
import { renderTemplate, generateItemsTable, numberToWords, localDateStr, localDateTimeStr, buildPrintDocument, PM_LABEL, TemplateVars } from '@/lib/template-engine';
import { DEFAULT_TEMPLATE_DON_HANG_NHAP } from '@/lib/default-templates';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp', ordered: 'Đã đặt hàng', received: 'Đã nhận hàng', cancelled: 'Đã hủy',
};

function buildVars(po: any, s: StoreSetting | null): TemplateVars {
  const fmtN = (n: number) => Number(n).toLocaleString('vi-VN') + 'đ';
  const fmtF = (n: number, cur: string) => {
    if (cur === 'VND') return fmtN(n);
    const sym = cur === 'CNY' ? '¥' : cur === 'USD' ? '$' : cur;
    return `${sym}${Number(n).toLocaleString('vi-VN')}`;
  };
  const cur = po.currency || 'VND';
  const isVnd = cur === 'VND';

  const itemRows = (po.items || []).map((item: any, i: number) => ({
    line_stt: String(i + 1),
    line_name: item.productName,
    line_code: item.productCode,
    line_qty: String(item.quantity),
    line_unit: item.unit || '—',
    line_price_foreign: fmtF(item.priceForeign, cur),
    line_total_foreign: fmtF(item.totalForeign, cur),
    line_price_vnd: fmtN(item.priceVnd),
    line_total_vnd: fmtN(item.totalVnd),
  }));

  const tableRows = (po.items || []).map((item: any, i: number) => ({
    stt: i + 1,
    name: item.productName,
    code: item.productCode,
    qty: item.quantity,
    unit: item.unit || '—',
    price: isVnd ? Number(item.priceVnd) : Number(item.priceForeign),
    discountPct: item.discountPercent || 0,
    total: isVnd ? Number(item.totalVnd) : Number(item.totalForeign),
  }));

  const pmStr = (po.payments || []).length > 0
    ? po.payments.map((p: any) => `${PM_LABEL[p.paymentMethod] || p.paymentMethod} (${fmtN(p.amount)})`).join(' + ')
    : '';

  return {
    store_name: s?.storeName || 'An Phát TMS',
    store_address: s?.storeAddress || '',
    store_phone: s?.storePhone || '',
    store_email: s?.storeEmail || '',
    store_tax_code: s?.taxCode || '',
    print_footer: s?.printFooter || '',
    print_date: localDateTimeStr(),
    po_code: po.code,
    po_date: po.date ? localDateStr(new Date(po.date)) : '',
    po_status: STATUS_LABEL[po.status] || po.status,
    supplier_name: po.supplier?.name || '—',
    supplier_code: po.supplier?.code || '',
    supplier_phone: po.supplier?.phone || '',
    supplier_address: po.supplier?.address || '',
    currency: cur,
    exchange_rate: isVnd ? '' : Number(po.exchangeRate).toLocaleString('vi-VN'),
    expected_date: po.expectedDeliveryDate ? localDateStr(new Date(po.expectedDeliveryDate)) : '',
    received_date: po.receivedDate ? localDateStr(new Date(po.receivedDate)) : '',
    staff_name: po.assignedTo?.fullName || po.assignedTo?.username || '',
    branch_name: po.branch?.name || '',
    notes: po.notes || '',
    payment_method: pmStr,
    subtotal_foreign: isVnd ? '' : fmtF(Number(po.subtotalForeign), cur),
    subtotal_vnd: fmtN(Number(po.subtotalVnd)),
    discount_amount: Number(po.discountAmount) > 0 ? fmtN(Number(po.discountAmount)) : '',
    shipping_fee: Number(po.shippingFee) > 0 ? fmtN(Number(po.shippingFee)) : '',
    total_amount_vnd: fmtN(Number(po.totalAmountVnd)),
    total_text: numberToWords(Math.round(Number(po.totalAmountVnd))),
    paid_amount: Number(po.paidAmountVnd) > 0 ? fmtN(Number(po.paidAmountVnd)) : '',
    debt_amount: Number(po.debtAmountVnd) > 0 ? fmtN(Number(po.debtAmountVnd)) : '',
    items: itemRows,
    items_table: generateItemsTable(tableRows),
  };
}

function PrintLayout({ html, paperSize, copies }: { html: string; paperSize: string; copies: number }) {
  const maxWidth = paperSize === 'A5' ? 540 : 740;
  const docHtml = buildPrintDocument(html, paperSize);
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#000', background: '#fff', minHeight: '100vh' }}>
      <style>{`@media print{.no-print{display:none!important}.print-wrap{padding-top:0!important}@page{size:${paperSize} portrait;margin:12mm 15mm}}`}</style>
      <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: '#1a1d2e', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 100 }}>
        <button onClick={() => window.print()} style={{ padding: '6px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>🖨 In ngay</button>
        <button onClick={() => window.close()} style={{ padding: '6px 16px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>✕ Đóng</button>
        <span style={{ color: '#9ca3af', fontSize: 12 }}>Ctrl+P để in thủ công</span>
      </div>
      {copies === 2 ? (
        <div className="print-wrap" style={{ maxWidth, margin: '0 auto', padding: '52px 20px 0' }}>
          <div dangerouslySetInnerHTML={{ __html: html }} />
          <div style={{ borderTop: '2px dashed #999', margin: '24px 0', textAlign: 'center', color: '#999', fontSize: 11, paddingTop: 4 }}>— Xé tại đây — Lưu lại 1 bản —</div>
          <div dangerouslySetInnerHTML={{ __html: html }} />
          <div style={{ paddingBottom: 32 }} />
        </div>
      ) : (
        <div className="print-wrap" style={{ maxWidth, margin: '0 auto', padding: '52px 20px 32px' }} dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </div>
  );
}

export default function PrintDonHangNhapPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const copies = searchParams.get('copies') === '2' ? 2 : 1;
  const [html, setHtml] = useState('');
  const [paperSize, setPaperSize] = useState('A4');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      purchaseOrdersApi.getOne(Number(id)).catch(() => null),
      settingsApi.get().catch(() => null),
    ]).then(([po, settings]) => {
      if (!po) { setError('Không tìm thấy đơn hàng nhập'); setReady(true); return; }
      const template = settings?.templateDonHangNhap || DEFAULT_TEMPLATE_DON_HANG_NHAP;
      const pSize = settings?.paperSizeDonHangNhap || 'A4';
      setPaperSize(pSize);
      setHtml(renderTemplate(template, buildVars(po, settings)));
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

  return <PrintLayout html={html} paperSize={paperSize} copies={copies} />;
}
