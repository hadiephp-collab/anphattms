'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getPurchaseReturn } from '@/lib/purchase-returns';
import { settingsApi, StoreSetting } from '@/lib/settings';
import { renderTemplate, generateItemsTable, numberToWords, localDateStr, localDateTimeStr, TemplateVars } from '@/lib/template-engine';
import { DEFAULT_TEMPLATE_TRA_HANG_NCC } from '@/lib/default-templates';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp', sent: 'Đã gửi NCC', confirmed: 'Đã xác nhận', cancelled: 'Đã hủy',
};
const LOAI_LABEL: Record<string, string> = {
  HangLoi: 'Hàng Lỗi', HangSaiSo: 'Hàng Sai Số', HetHan: 'Hết Hạn', Khac: 'Khác',
};
const REFUND_LABEL: Record<string, string> = {
  none: 'Chưa hoàn', partial: 'Hoàn một phần', full: 'Đã hoàn đủ',
};

function buildVars(ret: any, s: StoreSetting | null): TemplateVars {
  const fmtN = (n: number) => Number(n).toLocaleString('vi-VN') + 'đ';

  const itemRows = (ret.items || []).map((item: any, i: number) => ({
    line_stt: String(i + 1),
    line_name: item.productName,
    line_code: item.productCode || '',
    line_qty: String(item.quantity),
    line_unit: item.unit || '—',
    line_price: fmtN(item.priceVnd),
    line_total: fmtN(item.totalVnd),
  }));

  const tableRows = (ret.items || []).map((item: any, i: number) => ({
    stt: i + 1,
    name: item.productName,
    code: item.productCode || '',
    qty: item.quantity,
    unit: item.unit || '—',
    price: Number(item.priceVnd),
    discountPct: 0,
    total: Number(item.totalVnd),
  }));

  return {
    store_name: s?.storeName || 'An Phát TMS',
    store_address: s?.storeAddress || '',
    store_phone: s?.storePhone || '',
    store_email: s?.storeEmail || '',
    store_tax_code: s?.taxCode || '',
    print_footer: s?.printFooter || '',
    print_date: localDateTimeStr(),
    return_code: ret.code,
    return_date: ret.returnDate ? localDateStr(new Date(ret.returnDate)) : localDateStr(new Date(ret.createdAt)),
    return_status: STATUS_LABEL[ret.status] || ret.status,
    supplier_name: ret.supplier?.name || '—',
    supplier_code: ret.supplier?.code || '',
    po_code: ret.purchaseOrder?.code || '',
    return_reason: LOAI_LABEL[ret.loaiTraHang] || ret.reason || '',
    notes: ret.notes || '',
    supplier_notes: ret.ghiChuNCC || '',
    staff_name: ret.actorName || '',
    branch_name: ret.branch?.name || '',
    total_amount: fmtN(Number(ret.totalAmountVnd)),
    total_text: numberToWords(Math.round(Number(ret.totalAmountVnd))),
    refunded_amount: Number(ret.refundedAmount) > 0 ? fmtN(Number(ret.refundedAmount)) : '',
    refund_status: REFUND_LABEL[ret.refundStatus] || ret.refundStatus,
    items: itemRows,
    items_table: generateItemsTable(tableRows),
  };
}

function PrintLayout({ html, paperSize, copies }: { html: string; paperSize: string; copies: number }) {
  const maxWidth = paperSize === 'A5' ? 540 : 740;
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

export default function PrintTraHangNccPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const copies = searchParams.get('copies') === '2' ? 2 : 1;
  const [html, setHtml] = useState('');
  const [paperSize, setPaperSize] = useState('A4');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      getPurchaseReturn(Number(id)).catch(() => null),
      settingsApi.get().catch(() => null),
    ]).then(([ret, settings]) => {
      if (!ret) { setError('Không tìm thấy phiếu trả hàng'); setReady(true); return; }
      const template = settings?.templateTraHangNcc || DEFAULT_TEMPLATE_TRA_HANG_NCC;
      const pSize = settings?.paperSizeTraHangNcc || 'A4';
      setPaperSize(pSize);
      setHtml(renderTemplate(template, buildVars(ret, settings)));
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
