'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ordersApi } from '@/lib/orders';
import { settingsApi, StoreSetting } from '@/lib/settings';
import { bankAccountsApi, BankAccount, getBankVietQRId } from '@/lib/bank-accounts';
import { renderTemplate, generateItemsTable, numberToWords, localDateStr, localDateTimeStr, PM_LABEL, TemplateVars } from '@/lib/template-engine';
import { DEFAULT_TEMPLATE_HOA_DON } from '@/lib/default-templates';

interface OrderDetail {
  id: number; code: string; date: string;
  customer?: { id: number; name: string; phone?: string } | null;
  assignedTo?: { id: number; fullName: string } | null;
  status: string; paymentStatus: string;
  subtotal: number; discountAmount: number; totalAmount: number;
  paidAmount: number; debtAmount: number; shippingFee: number;
  notes?: string | null;
  items: Array<{
    id: number; productCode: string; productName: string; unit?: string;
    quantity: number; unitPrice: number; discountPercent: number; lineTotal: number;
  }>;
  payments: Array<{
    id: number; amount: number; paymentMethod: string; note?: string; createdAt: string;
  }>;
}

function fmtOrderStatus(s: string): string {
  const m: Record<string, string> = {
    pending: 'Chờ xử lý', processing: 'Đang xử lý',
    completed: 'Hoàn thành', cancelled: 'Đã hủy',
  };
  return m[s] || s;
}

function fmtPaymentStatus(s: string): string {
  const m: Record<string, string> = {
    unpaid: 'Chưa thanh toán', partial: 'Thanh toán một phần', paid: 'Đã thanh toán',
  };
  return m[s] || s;
}

function buildPaymentQr(order: OrderDetail, bank: BankAccount | null): string {
  if (!bank || bank.loaiTaiKhoan !== 'NGAN_HANG' || !bank.accountNumber || !bank.bankName) return '';
  const bankId = getBankVietQRId(bank.bankName);
  if (!bankId) return '';
  const amount = Math.round(Number(order.totalAmount));
  const url = `https://img.vietqr.io/image/${bankId}-${bank.accountNumber}-print.png?amount=${amount}&addInfo=${encodeURIComponent(order.code)}&accountName=${encodeURIComponent(bank.accountHolder || '')}`;
  return `<img src="${url}" style="width:180px;height:180px;display:block" alt="QR thanh toán" />`;
}

function buildVars(order: OrderDetail, s: StoreSetting | null, bank: BankAccount | null = null): TemplateVars {
  const fmtN = (n: number) => Number(n).toLocaleString('vi-VN') + 'đ';

  const itemRows = order.items.map((item, i) => ({
    line_stt: String(i + 1),
    line_name: item.productName,
    line_code: item.productCode,
    line_qty: String(item.quantity),
    line_unit: item.unit || '—',
    line_price: Number(item.unitPrice).toLocaleString('vi-VN'),
    line_discount_pct: item.discountPercent > 0 ? `${item.discountPercent}%` : '',
    line_total: Number(item.lineTotal).toLocaleString('vi-VN'),
  }));

  const tableRows = order.items.map((item, i) => ({
    stt: i + 1,
    name: item.productName,
    code: item.productCode,
    qty: item.quantity,
    unit: item.unit || '—',
    price: Number(item.unitPrice),
    discountPct: item.discountPercent,
    total: Number(item.lineTotal),
  }));

  const pmStr = order.payments && order.payments.length > 0
    ? order.payments.map(p => `${PM_LABEL[p.paymentMethod] || p.paymentMethod} (${Number(p.amount).toLocaleString('vi-VN')}đ)`).join(' + ')
    : '';

  return {
    store_name: s?.storeName || 'An Phát TMS',
    store_address: s?.storeAddress || '',
    store_phone: s?.storePhone || '',
    store_email: s?.storeEmail || '',
    store_tax_code: s?.taxCode || '',
    print_footer: s?.printFooter || '',
    print_date: localDateTimeStr(),
    order_code: order.code,
    order_date: localDateStr(new Date(order.date)),
    order_status: fmtOrderStatus(order.status),
    payment_status: fmtPaymentStatus(order.paymentStatus),
    customer_name: order.customer?.name || 'Khách lẻ',
    customer_code: (order.customer as any)?.code || '',
    customer_phone: order.customer?.phone || '',
    customer_email: (order.customer as any)?.email || '',
    customer_address: (order.customer as any)?.address || '',
    staff_name: order.assignedTo?.fullName || '',
    branch_name: '',
    notes: order.notes || '',
    payment_method: pmStr,
    total_quantity: String(order.items.reduce((sum, i) => sum + i.quantity, 0)),
    subtotal: Number(order.subtotal) > 0 ? fmtN(Number(order.subtotal)) : '',
    discount_amount: Number(order.discountAmount) > 0 ? fmtN(Number(order.discountAmount)) : '',
    shipping_fee: Number(order.shippingFee) > 0 ? fmtN(Number(order.shippingFee)) : '',
    total_amount: fmtN(Number(order.totalAmount)),
    total_text: numberToWords(Math.round(Number(order.totalAmount))),
    paid_amount: Number(order.paidAmount) > 0 ? fmtN(Number(order.paidAmount)) : '',
    debt_amount: Number(order.debtAmount) > 0 ? fmtN(Number(order.debtAmount)) : '',
    items: itemRows,
    items_table: generateItemsTable(tableRows),
    payment_qr: buildPaymentQr(order, bank),
  };
}

export default function PrintOrderPage() {
  const { id } = useParams<{ id: string }>();
  const [html, setHtml] = useState('');
  const [paperSize, setPaperSize] = useState('A4');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      ordersApi.getOne(Number(id)).catch(() => null),
      settingsApi.get().catch(() => null),
      bankAccountsApi.getAll(true).catch(() => [] as BankAccount[]),
    ]).then(([order, settings, bankAccounts]) => {
      if (!order) { setError('Không tìm thấy đơn hàng'); setReady(true); return; }
      const defaultBank = (bankAccounts as BankAccount[]).find(b => b.isDefault) ?? null;
      const template = settings?.templateHoaDon || DEFAULT_TEMPLATE_HOA_DON;
      const pSize = settings?.paperSizeHoaDon || 'A4';
      setPaperSize(pSize);
      const vars = buildVars(order as OrderDetail, settings, defaultBank);
      setHtml(renderTemplate(template, vars));
      setReady(true);
    });
  }, [id]);

  useEffect(() => {
    if (ready && html) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [ready, html]);

  if (!ready) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial', color: '#999', fontSize: 14 }}>
      Đang tải...
    </div>
  );
  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial', color: '#f00', fontSize: 14 }}>
      {error}
    </div>
  );

  const maxWidth = paperSize === 'A5' ? 540 : 740;

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#000', background: '#fff', minHeight: '100vh' }}>
      <style>{`@media print{.no-print{display:none!important}.print-wrap{padding-top:0!important}@page{size:${paperSize} portrait;margin:12mm 15mm}}`}</style>
      <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: '#1a1d2e', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 100 }}>
        <button onClick={() => window.print()} style={{ padding: '6px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          🖨 In ngay
        </button>
        <button onClick={() => window.close()} style={{ padding: '6px 16px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          ✕ Đóng
        </button>
        <span style={{ color: '#9ca3af', fontSize: 12 }}>Ctrl+P để in thủ công</span>
      </div>
      <div
        className="print-wrap"
        style={{ maxWidth, margin: '0 auto', padding: '52px 20px 32px' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
