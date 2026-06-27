'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ordersApi } from '@/lib/orders';

interface OrderItem {
  id: number;
  productCode: string;
  productName: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  lineTotal: number;
  notes?: string | null;
}

interface OrderPayment {
  id: number;
  amount: number;
  paymentMethod: string;
  note?: string | null;
  createdAt: string;
}

interface OrderDetail {
  id: number;
  code: string;
  date: string;
  deliveryDate?: string;
  customer?: { id: number; name: string; phone?: string; address?: string };
  assignedTo?: { id: number; fullName: string };
  orderType: string;
  shippingMethod: string;
  shippingAddress?: string | null;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  shippingFee: number;
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  depositAmount?: number | null;
  status: string;
  invoiceStatus: string;
  paymentStatus: string;
  source?: string | null;
  tags?: string | null;
  reference?: string | null;
  notes?: string | null;
  items: OrderItem[];
  payments: OrderPayment[];
}

const PAY_METHOD_LABEL: Record<string, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  other: 'Khác',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xử lý',
  processing: 'Đang xử lý',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

export default function PrintOrderPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    ordersApi.getOne(Number(id))
      .then((data: any) => setOrder(data))
      .catch(() => setError('Không tìm thấy đơn hàng'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading && order) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [loading, order]);

  const fmt = (n?: number | null) =>
    n != null ? Number(n).toLocaleString('vi-VN') : '0';

  const fmtDate = (s?: string | null) =>
    s ? new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400 text-sm">Đang tải đơn hàng...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500 text-sm">{error || 'Không tìm thấy đơn hàng'}</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #f3f4f6; }

        @media print {
          body { background: white; margin: 0; }
          .no-print { display: none !important; }
          .print-page { box-shadow: none !important; margin: 0 !important; padding: 12mm !important; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>

      {/* Controls (hidden when printing) */}
      <div className="no-print flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200 sticky top-0 z-10">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          In ngay
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
        >
          Đóng
        </button>
        <span className="text-xs text-gray-400 ml-2">Trang sẽ tự in sau khi tải xong</span>
      </div>

      {/* Print content */}
      <div className="no-print h-6" />
      <div
        className="print-page bg-white mx-auto shadow-lg"
        style={{ width: '210mm', minHeight: '297mm', padding: '15mm', fontFamily: '"Times New Roman", Times, serif' }}
      >
        {/* Company Header */}
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-xl font-bold text-gray-900 uppercase tracking-wide">An Phát TMS</div>
            <div className="text-xs text-gray-500 mt-1">Hệ thống quản lý thương mại</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-800 uppercase tracking-wider">Phiếu Xuất Hàng</div>
            <div className="mt-1 text-sm font-semibold text-gray-600 font-mono">#{order.code}</div>
          </div>
        </div>

        <hr style={{ borderColor: '#374151', borderWidth: '1.5px', marginBottom: '12px' }} />

        {/* Order + Customer info */}
        <div className="grid grid-cols-2 gap-6 mb-5 text-sm">
          <div>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                <tr>
                  <td className="text-gray-500 pr-3 py-0.5 text-xs" style={{ whiteSpace: 'nowrap' }}>Ngày tạo:</td>
                  <td className="font-medium text-gray-800 text-xs">
                    {new Date(order.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
                {order.deliveryDate && (
                  <tr>
                    <td className="text-gray-500 pr-3 py-0.5 text-xs">Ngày giao:</td>
                    <td className="font-medium text-gray-800 text-xs">{fmtDate(order.deliveryDate)}</td>
                  </tr>
                )}
                {order.assignedTo && (
                  <tr>
                    <td className="text-gray-500 pr-3 py-0.5 text-xs">Nhân viên:</td>
                    <td className="font-medium text-gray-800 text-xs">{order.assignedTo.fullName}</td>
                  </tr>
                )}
                <tr>
                  <td className="text-gray-500 pr-3 py-0.5 text-xs">Trạng thái:</td>
                  <td className="font-medium text-gray-800 text-xs">{STATUS_LABEL[order.status] ?? order.status}</td>
                </tr>
                {order.reference && (
                  <tr>
                    <td className="text-gray-500 pr-3 py-0.5 text-xs">Tham chiếu:</td>
                    <td className="font-medium text-gray-800 text-xs">{order.reference}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">Khách hàng</div>
            <div className="font-bold text-gray-800 text-sm">{order.customer?.name ?? 'Khách lẻ'}</div>
            {order.customer?.phone && <div className="text-xs text-gray-600 mt-0.5">{order.customer.phone}</div>}
            {order.shippingAddress && (
              <div className="text-xs text-gray-500 mt-1 leading-relaxed">{order.shippingAddress}</div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '12px' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e3a5f', color: 'white' }}>
              <th style={{ border: '1px solid #374151', padding: '6px 8px', textAlign: 'left', width: '28px', fontWeight: 600 }}>STT</th>
              <th style={{ border: '1px solid #374151', padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>Tên sản phẩm</th>
              <th style={{ border: '1px solid #374151', padding: '6px 8px', textAlign: 'left', width: '80px', fontWeight: 600 }}>Mã SP</th>
              <th style={{ border: '1px solid #374151', padding: '6px 8px', textAlign: 'center', width: '44px', fontWeight: 600 }}>ĐVT</th>
              <th style={{ border: '1px solid #374151', padding: '6px 8px', textAlign: 'center', width: '40px', fontWeight: 600 }}>SL</th>
              <th style={{ border: '1px solid #374151', padding: '6px 8px', textAlign: 'right', width: '90px', fontWeight: 600 }}>Đơn giá</th>
              <th style={{ border: '1px solid #374151', padding: '6px 8px', textAlign: 'center', width: '46px', fontWeight: 600 }}>CK%</th>
              <th style={{ border: '1px solid #374151', padding: '6px 8px', textAlign: 'right', width: '90px', fontWeight: 600 }}>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, idx) => (
              <tr key={item.id} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                <td style={{ border: '1px solid #d1d5db', padding: '5px 8px', textAlign: 'center', color: '#6b7280' }}>{idx + 1}</td>
                <td style={{ border: '1px solid #d1d5db', padding: '5px 8px' }}>
                  <div style={{ fontWeight: 500 }}>{item.productName}</div>
                  {item.notes && <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '1px' }}>{item.notes}</div>}
                </td>
                <td style={{ border: '1px solid #d1d5db', padding: '5px 8px', color: '#6b7280', fontFamily: 'monospace' }}>{item.productCode}</td>
                <td style={{ border: '1px solid #d1d5db', padding: '5px 8px', textAlign: 'center', color: '#6b7280' }}>{item.unit || '—'}</td>
                <td style={{ border: '1px solid #d1d5db', padding: '5px 8px', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                <td style={{ border: '1px solid #d1d5db', padding: '5px 8px', textAlign: 'right' }}>{fmt(item.unitPrice)}</td>
                <td style={{ border: '1px solid #d1d5db', padding: '5px 8px', textAlign: 'center', color: '#d97706' }}>
                  {Number(item.discountPercent) > 0 ? `${item.discountPercent}%` : '—'}
                </td>
                <td style={{ border: '1px solid #d1d5db', padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>{fmt(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Bottom: Notes + Totals */}
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', marginBottom: '20px' }}>
          {/* Notes + Payments */}
          <div style={{ flex: 1, fontSize: '12px' }}>
            {order.notes && (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontWeight: 600, color: '#374151', marginBottom: '3px', fontSize: '11px', textTransform: 'uppercase' }}>Ghi chú:</div>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', padding: '6px 8px', color: '#4b5563', lineHeight: 1.5 }}>
                  {order.notes}
                </div>
              </div>
            )}
            {order.payments && order.payments.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, color: '#374151', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Lịch sử thanh toán:</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f3f4f6' }}>
                      <th style={{ border: '1px solid #e5e7eb', padding: '4px 6px', textAlign: 'left' }}>Ngày</th>
                      <th style={{ border: '1px solid #e5e7eb', padding: '4px 6px', textAlign: 'left' }}>Hình thức</th>
                      <th style={{ border: '1px solid #e5e7eb', padding: '4px 6px', textAlign: 'right' }}>Số tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.payments.map(p => (
                      <tr key={p.id}>
                        <td style={{ border: '1px solid #e5e7eb', padding: '3px 6px', color: '#6b7280' }}>{fmtDate(p.createdAt)}</td>
                        <td style={{ border: '1px solid #e5e7eb', padding: '3px 6px' }}>{PAY_METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod}</td>
                        <td style={{ border: '1px solid #e5e7eb', padding: '3px 6px', textAlign: 'right', fontWeight: 500 }}>{fmt(p.amount)}đ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Totals */}
          <div style={{ width: '220px', fontSize: '13px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '4px 0', color: '#6b7280' }}>Tổng hàng:</td>
                  <td style={{ padding: '4px 0', textAlign: 'right' }}>{fmt(order.subtotal)}đ</td>
                </tr>
                {Number(order.discountAmount) > 0 && (
                  <tr>
                    <td style={{ padding: '4px 0', color: '#6b7280' }}>
                      Chiết khấu{Number(order.discountPercent) > 0 ? ` (${order.discountPercent}%)` : ''}:
                    </td>
                    <td style={{ padding: '4px 0', textAlign: 'right', color: '#d97706' }}>-{fmt(order.discountAmount)}đ</td>
                  </tr>
                )}
                {Number(order.shippingFee) > 0 && (
                  <tr>
                    <td style={{ padding: '4px 0', color: '#6b7280' }}>Phí vận chuyển:</td>
                    <td style={{ padding: '4px 0', textAlign: 'right' }}>{fmt(order.shippingFee)}đ</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={2} style={{ padding: '2px 0' }}>
                    <hr style={{ borderColor: '#374151', borderWidth: '1px' }} />
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '5px 0', fontWeight: 700, fontSize: '15px' }}>TỔNG TIỀN:</td>
                  <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 700, fontSize: '15px' }}>{fmt(order.totalAmount)}đ</td>
                </tr>
                {Number(order.paidAmount) > 0 && (
                  <tr>
                    <td style={{ padding: '3px 0', color: '#16a34a' }}>Đã thu:</td>
                    <td style={{ padding: '3px 0', textAlign: 'right', color: '#16a34a', fontWeight: 500 }}>{fmt(order.paidAmount)}đ</td>
                  </tr>
                )}
                {Number(order.debtAmount) > 0 && (
                  <tr>
                    <td style={{ padding: '3px 0', color: '#dc2626', fontWeight: 600 }}>Còn nợ:</td>
                    <td style={{ padding: '3px 0', textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>{fmt(order.debtAmount)}đ</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Signature lines */}
        <hr style={{ borderColor: '#d1d5db', marginBottom: '16px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', textAlign: 'center', fontSize: '12px' }}>
          {['Người mua hàng', 'Người bán hàng', 'Thủ kho'].map(role => (
            <div key={role}>
              <div style={{ fontWeight: 600, color: '#374151', marginBottom: '2px' }}>{role}</div>
              <div style={{ fontSize: '10px', color: '#9ca3af' }}>(Ký, ghi rõ họ tên)</div>
              <div style={{ marginTop: '48px', borderTop: '1px solid #6b7280', paddingTop: '4px', fontSize: '10px', color: '#d1d5db' }}>Họ và tên</div>
            </div>
          ))}
        </div>
      </div>
      <div className="no-print h-8" />
    </>
  );
}
