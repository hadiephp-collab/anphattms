'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { shippingApi } from '@/lib/shipping';
import { settingsApi, StoreSetting } from '@/lib/settings';
import { renderTemplate, localDateStr, localDateTimeStr, TemplateVars } from '@/lib/template-engine';
import { DEFAULT_TEMPLATE_VAN_DON } from '@/lib/default-templates';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ lấy hàng', picked_up: 'Đã lấy hàng', in_transit: 'Đang vận chuyển',
  delivered: 'Đã giao', returned: 'Hoàn hàng', cancelled: 'Đã hủy',
};

function buildVars(ship: any, s: StoreSetting | null): TemplateVars {
  const fmtN = (n: number) => Number(n).toLocaleString('vi-VN') + 'đ';
  return {
    store_name: s?.storeName || 'An Phát TMS',
    store_address: s?.storeAddress || '',
    store_phone: s?.storePhone || '',
    store_email: s?.storeEmail || '',
    store_tax_code: s?.taxCode || '',
    print_footer: s?.printFooter || '',
    print_date: localDateTimeStr(),
    shipment_code: ship.code,
    tracking_code: ship.trackingCode || '',
    shipment_date: localDateStr(new Date(ship.createdAt)),
    carrier_name: ship.carrierName || '—',
    shipment_type: ship.type === 'cod' ? 'COD (Thu hộ tiền)' : 'B2B',
    order_code: ship.orderCode || '',
    scheduled_date: ship.scheduledDate ? localDateStr(new Date(ship.scheduledDate)) : '',
    delivered_date: ship.deliveredDate ? localDateStr(new Date(ship.deliveredDate)) : '',
    shipment_status: STATUS_LABEL[ship.status] || ship.status,
    notes: ship.notes || '',
    receiver_name: ship.receiverName || '—',
    receiver_phone: ship.receiverPhone || '',
    receiver_address: ship.receiverAddress || '',
    shipping_fee: Number(ship.shippingFee) > 0 ? fmtN(Number(ship.shippingFee)) : '0đ',
    cod_amount: Number(ship.codAmount) > 0 ? fmtN(Number(ship.codAmount)) : '',
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

export default function PrintVanDonPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const copies = searchParams.get('copies') === '2' ? 2 : 1;
  const [html, setHtml] = useState('');
  const [paperSize, setPaperSize] = useState('A4');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      shippingApi.getShipment(Number(id)).catch(() => null),
      settingsApi.get().catch(() => null),
    ]).then(([ship, settings]) => {
      if (!ship) { setError('Không tìm thấy vận đơn'); setReady(true); return; }
      const template = settings?.templateVanDon || DEFAULT_TEMPLATE_VAN_DON;
      const pSize = settings?.paperSizeVanDon || 'A4';
      setPaperSize(pSize);
      setHtml(renderTemplate(template, buildVars(ship, settings)));
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
