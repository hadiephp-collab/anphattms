'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ordersApi } from '@/lib/orders';
import { settingsApi, StoreSetting } from '@/lib/settings';

interface OrderDetail {
  id: number; code: string; date: string;
  customer?: { id: number; name: string; phone?: string } | null;
  assignedTo?: { id: number; fullName: string; code?: string } | null;
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

const PM: Record<string, string> = {
  cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', momo: 'MoMo', TM: 'Tiền mặt', CK: 'Chuyển khoản', MM: 'MoMo', other: 'Khác',
};
const fmt = (n: number) => Number(n).toLocaleString('vi-VN') + 'đ';
const fmtDate = (s: string) => new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

function numberToWords(n: number): string {
  if (n === 0) return 'Không đồng';
  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const teens = ['mười', 'mười một', 'mười hai', 'mười ba', 'mười bốn', 'mười lăm', 'mười sáu', 'mười bảy', 'mười tám', 'mười chín'];

  function readGroup(num: number): string {
    if (num === 0) return '';
    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const u = num % 10;
    let s = '';
    if (h > 0) s += units[h] + ' trăm ';
    if (t === 1) { s += teens[u] + ' '; }
    else if (t > 1) {
      s += units[t] + ' mươi ';
      if (u === 5) s = s.replace('mươi ', 'mươi lăm ').replace('lăm lăm', 'lăm');
      else if (u > 0) s += units[u] + ' ';
    } else if (u > 0 && h > 0) { s += 'lẻ ' + units[u] + ' '; }
    else if (u > 0) { s += units[u] + ' '; }
    return s;
  }

  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const remainder = n % 1_000;

  let result = '';
  if (billions > 0) result += readGroup(billions) + 'tỷ ';
  if (millions > 0) result += readGroup(millions) + 'triệu ';
  if (thousands > 0) result += readGroup(thousands) + 'nghìn ';
  if (remainder > 0) result += readGroup(remainder);
  result = result.trim() + ' đồng';
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export default function PrintOrderPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [settings, setSettings] = useState<StoreSetting | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      ordersApi.getOne(Number(id)).catch(() => null),
      settingsApi.get().catch(() => null),
    ]).then(([o, s]) => {
      setOrder(o as OrderDetail | null);
      setSettings(s);
      setReady(true);
    });
  }, [id]);

  useEffect(() => {
    if (ready) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [ready]);

  if (!ready) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial', color: '#999', fontSize: 14 }}>Đang tải...</div>;
  if (!order) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial', color: '#f00', fontSize: 14 }}>Không tìm thấy đơn hàng</div>;

  const store = settings;
  const hasDiscount = Number(order.discountAmount) > 0;
  const hasShipping = Number(order.shippingFee) > 0;

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#000', background: '#fff', minHeight: '100vh' }}>
      {/* Toolbar - hidden when printing */}
      <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: '#1a1d2e', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 100 }}>
        <button onClick={() => window.print()} style={{ padding: '6px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          🖨 In ngay
        </button>
        <button onClick={() => window.close()} style={{ padding: '6px 16px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          ✕ Đóng
        </button>
        <span style={{ color: '#9ca3af', fontSize: 12 }}>Nhấn Ctrl+P để in thủ công</span>
      </div>

      {/* Print content */}
      <div style={{ maxWidth: 740, margin: '0 auto', padding: '52px 0 32px' }} className="no-print-padding">
        <style>{`@media print { .no-print { display: none !important; } div[style*="52px"] { padding-top: 0 !important; } }`}</style>

        {/* Store header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottom: '2px solid #000', paddingBottom: 12 }}>
          <div style={{ flex: 1 }}>
            {store?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt="Logo" style={{ height: 56, objectFit: 'contain', marginBottom: 6, display: 'block' }} />
            )}
            <div style={{ fontWeight: 700, fontSize: 15 }}>{store?.storeName || 'An Phát TMS'}</div>
            {store?.storeAddress && <div style={{ color: '#555', marginTop: 2, fontSize: 11 }}>Địa chỉ: {store.storeAddress}</div>}
            {store?.storePhone && <div style={{ color: '#555', marginTop: 1, fontSize: 11 }}>ĐT: {store.storePhone}</div>}
            {store?.taxCode && <div style={{ color: '#555', marginTop: 1, fontSize: 11 }}>MST: {store.taxCode}</div>}
          </div>
          <div style={{ textAlign: 'right', minWidth: 180 }}>
            <div style={{ fontSize: 18, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Hóa Đơn Bán Hàng</div>
            <div style={{ marginTop: 6, fontSize: 13 }}><strong>Số:</strong> <span style={{ fontFamily: 'monospace' }}>{order.code}</span></div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}><strong>Ngày:</strong> {fmtDate(order.date)}</div>
          </div>
        </div>

        {/* Customer info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', marginBottom: 14, fontSize: 12 }}>
          <div><strong>Khách hàng:</strong> {order.customer?.name || 'Khách lẻ'}</div>
          <div><strong>SĐT:</strong> {order.customer?.phone || '—'}</div>
          {order.assignedTo && <div><strong>Nhân viên:</strong> {order.assignedTo.fullName}</div>}
          <div><strong>Trạng thái TT:</strong> {order.paymentStatus === 'paid' ? 'Đã thanh toán' : order.paymentStatus === 'partial' ? 'Thanh toán 1 phần' : 'Chưa thanh toán'}</div>
        </div>

        {/* Items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f5f5f5', borderTop: '1px solid #ccc', borderBottom: '1px solid #ccc' }}>
              <th style={{ padding: '6px 8px', textAlign: 'center', width: 28, fontWeight: 600 }}>STT</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>Tên sản phẩm</th>
              <th style={{ padding: '6px 8px', textAlign: 'center', width: 44, fontWeight: 600 }}>ĐVT</th>
              <th style={{ padding: '6px 8px', textAlign: 'center', width: 40, fontWeight: 600 }}>SL</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', width: 100, fontWeight: 600 }}>Đơn giá</th>
              {order.items.some(i => i.discountPercent > 0) && (
                <th style={{ padding: '6px 8px', textAlign: 'center', width: 50, fontWeight: 600 }}>CK%</th>
              )}
              <th style={{ padding: '6px 8px', textAlign: 'right', width: 110, fontWeight: 600 }}>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '5px 8px', textAlign: 'center', color: '#777' }}>{i + 1}</td>
                <td style={{ padding: '5px 8px' }}>
                  <div style={{ fontWeight: 500 }}>{item.productName}</div>
                  <div style={{ fontSize: 10, color: '#888' }}>{item.productCode}</div>
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'center', color: '#555' }}>{item.unit || '—'}</td>
                <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right' }}>{Number(item.unitPrice).toLocaleString('vi-VN')}</td>
                {order.items.some(i2 => i2.discountPercent > 0) && (
                  <td style={{ padding: '5px 8px', textAlign: 'center', color: '#dc2626' }}>
                    {item.discountPercent > 0 ? `${item.discountPercent}%` : ''}
                  </td>
                )}
                <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>{Number(item.lineTotal).toLocaleString('vi-VN')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <table style={{ minWidth: 260, fontSize: 12 }}>
            <tbody>
              {hasDiscount && <>
                <tr>
                  <td style={{ padding: '3px 8px', color: '#555' }}>Tạm tính:</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right' }}>{fmt(order.subtotal)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '3px 8px', color: '#555' }}>Giảm giá:</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: '#dc2626' }}>- {fmt(order.discountAmount)}</td>
                </tr>
              </>}
              {hasShipping && (
                <tr>
                  <td style={{ padding: '3px 8px', color: '#555' }}>Phí vận chuyển:</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right' }}>{fmt(order.shippingFee)}</td>
                </tr>
              )}
              <tr style={{ borderTop: '1.5px solid #000' }}>
                <td style={{ padding: '7px 8px', fontWeight: 700, fontSize: 13 }}>TỔNG TIỀN:</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, fontSize: 14 }}>{fmt(order.totalAmount)}</td>
              </tr>
              {Number(order.paidAmount) > 0 && (
                <tr>
                  <td style={{ padding: '3px 8px', color: '#16a34a' }}>Đã thanh toán:</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{fmt(order.paidAmount)}</td>
                </tr>
              )}
              {Number(order.debtAmount) > 0 && (
                <tr>
                  <td style={{ padding: '3px 8px', color: '#dc2626', fontWeight: 600 }}>Còn lại:</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>{fmt(order.debtAmount)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Amount in words */}
        <div style={{ fontStyle: 'italic', fontSize: 11, marginBottom: 12, color: '#444' }}>
          Bằng chữ: <em style={{ fontStyle: 'normal' }}>{numberToWords(Math.round(Number(order.totalAmount)))}</em>
        </div>

        {/* Payment methods */}
        {order.payments && order.payments.length > 0 && (
          <div style={{ marginBottom: 12, fontSize: 11, color: '#555' }}>
            Phương thức TT: {order.payments.map(p => `${PM[p.paymentMethod] || p.paymentMethod} (${Number(p.amount).toLocaleString('vi-VN')}đ)`).join(' + ')}
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div style={{ marginBottom: 16, padding: '6px 10px', background: '#fffbeb', borderLeft: '3px solid #f59e0b', fontSize: 11 }}>
            <strong>Ghi chú:</strong> {order.notes}
          </div>
        )}

        {/* Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 28, textAlign: 'center', fontSize: 12 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Người mua hàng</div>
            <div style={{ fontSize: 10, color: '#777', marginBottom: 44 }}>(Ký, ghi rõ họ tên)</div>
            <div style={{ borderTop: '1px solid #999', paddingTop: 4, fontSize: 11, color: '#555', fontStyle: 'italic' }}>{order.customer?.name || 'Khách lẻ'}</div>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Người bán hàng</div>
            <div style={{ fontSize: 10, color: '#777', marginBottom: 44 }}>(Ký, ghi rõ họ tên)</div>
            <div style={{ borderTop: '1px solid #999', paddingTop: 4, fontSize: 11, color: '#555', fontStyle: 'italic' }}>{order.assignedTo?.fullName || store?.storeName || ''}</div>
          </div>
        </div>

        {/* Footer */}
        {(store?.printFooter || store?.printHeader) && (
          <div style={{ marginTop: 24, textAlign: 'center', fontSize: 10, color: '#888', borderTop: '1px dashed #ccc', paddingTop: 8 }}>
            {store.printFooter || store.printHeader}
          </div>
        )}
      </div>
    </div>
  );
}
