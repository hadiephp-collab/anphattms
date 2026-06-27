'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { returnsApi } from '@/lib/returns';
import { settingsApi, type StoreSetting } from '@/lib/settings';

interface ReturnItem {
  id: number; productCode: string; productName: string; unit: string | null;
  quantity: number; unitPrice: number; refundAmount: number;
  condition: string; restoreStock: boolean; itemReason: string | null;
}
interface ReturnExchangeItem {
  id: number; productCode: string; productName: string; unit: string | null;
  quantity: number; unitPrice: number; discountAmount: number; taxPercent: number; lineTotal: number;
}
interface ReturnRecord {
  id: number; code: string; status: string; refundMethod: string;
  totalRefund: number; reason: string | null; notes: string | null;
  rejectReason: string | null; processedAt: string | null;
  referenceCode: string | null; documentDate: string | null;
  createdAt: string;
  order: { id: number; code: string; totalAmount: number } | null;
  customer: { id: number; name: string; phone: string | null } | null;
  createdBy: { id: number; username: string; fullName: string | null } | null;
  returnBranch: { id: number; name: string } | null;
  items: ReturnItem[];
  exchangeItems: ReturnExchangeItem[];
}

const REFUND_LABEL: Record<string, string> = {
  cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản',
  exchange: 'Đổi hàng', no_refund: 'Không hoàn tiền',
};
const CONDITION_LABEL: Record<string, string> = {
  good: 'Còn tốt', damaged: 'Hỏng hóc', missing_parts: 'Thiếu PK',
};

function fmt(n: number) {
  return Math.round(Number(n)).toLocaleString('vi-VN');
}
function fmtDt(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function PrintReturnPage() {
  const { id } = useParams<{ id: string }>();
  const [ret, setRet]       = useState<ReturnRecord | null>(null);
  const [store, setStore]   = useState<StoreSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    Promise.all([
      returnsApi.getOne(Number(id)),
      settingsApi.get().catch(() => null),
    ])
      .then(([retData, storeData]) => {
        setRet(retData);
        setStore(storeData);
      })
      .catch(() => setError('Không tải được dữ liệu phiếu trả hàng'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading && ret) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [loading, ret]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ color: '#9ca3af', fontSize: '14px' }}>Đang tải phiếu trả hàng...</div>
      </div>
    );
  }
  if (error || !ret) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ color: '#ef4444', fontSize: '14px' }}>{error || 'Không tìm thấy phiếu'}</div>
      </div>
    );
  }

  const storeName    = store?.storeName?.trim() || 'An Phát TMS';
  const totalQty     = ret.items.reduce((s, i) => s + i.quantity, 0);
  const totalExchange = ret.exchangeItems?.reduce((s, i) => s + i.lineTotal, 0) ?? 0;
  const isExchange   = ret.refundMethod === 'exchange';

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

      {/* Toolbar (ẩn khi in) */}
      <div className="no-print" style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 24px', background: 'white', borderBottom: '1px solid #e5e7eb',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={() => window.print()} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 16px', background: '#2563eb', color: 'white',
          fontSize: '13px', fontWeight: 600, borderRadius: '8px', border: 'none', cursor: 'pointer',
        }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          In ngay
        </button>
        <button onClick={() => window.close()} style={{
          padding: '8px 16px', background: '#f3f4f6', color: '#6b7280',
          fontSize: '13px', fontWeight: 500, borderRadius: '8px', border: 'none', cursor: 'pointer',
        }}>
          Đóng
        </button>
        <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '4px' }}>Trang sẽ tự in sau khi tải xong</span>
      </div>

      <div className="no-print" style={{ height: '24px' }} />

      {/* Trang in A4 */}
      <div className="print-page" style={{
        width: '210mm', minHeight: '297mm', padding: '15mm',
        background: 'white', margin: '0 auto', boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        fontFamily: '"Times New Roman", Times, serif',
      }}>

        {/* ── Header cửa hàng ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            {store?.logoUrl && (
              <img src={store.logoUrl} alt="Logo" style={{ height: '56px', maxWidth: '120px', objectFit: 'contain' }} />
            )}
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {storeName}
              </div>
              {store?.storeAddress && (
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{store.storeAddress}</div>
              )}
              {(store?.storePhone || store?.storeEmail) && (
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px' }}>
                  {[store.storePhone, store.storeEmail].filter(Boolean).join(' · ')}
                </div>
              )}
              {store?.taxCode && (
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px' }}>MST: {store.taxCode}</div>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Phiếu Trả Hàng
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#4b5563', fontFamily: 'monospace', marginTop: '4px' }}>
              #{ret.code}
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
              Ngày tạo: {fmtDt(ret.createdAt)}
            </div>
          </div>
        </div>

        {/* HTML printHeader (nếu có — cài đặt sau) */}
        {store?.printHeader && (
          <div style={{ marginBottom: '12px' }} dangerouslySetInnerHTML={{ __html: store.printHeader }} />
        )}

        <hr style={{ borderColor: '#374151', borderWidth: '1.5px', marginBottom: '14px' }} />

        {/* ── Thông tin phiếu + khách hàng ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '16px', fontSize: '12px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>
              Thông tin phiếu
            </div>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                {ret.order && (
                  <tr>
                    <td style={{ color: '#9ca3af', paddingRight: '12px', paddingBottom: '3px', whiteSpace: 'nowrap' }}>Đơn hàng gốc:</td>
                    <td style={{ fontWeight: 500, paddingBottom: '3px', fontFamily: 'monospace' }}>{ret.order.code}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ color: '#9ca3af', paddingRight: '12px', paddingBottom: '3px' }}>Hình thức hoàn:</td>
                  <td style={{ fontWeight: 500, paddingBottom: '3px' }}>{REFUND_LABEL[ret.refundMethod] ?? ret.refundMethod}</td>
                </tr>
                {ret.returnBranch && (
                  <tr>
                    <td style={{ color: '#9ca3af', paddingRight: '12px', paddingBottom: '3px' }}>Chi nhánh trả:</td>
                    <td style={{ fontWeight: 500, paddingBottom: '3px' }}>{ret.returnBranch.name}</td>
                  </tr>
                )}
                {ret.referenceCode && (
                  <tr>
                    <td style={{ color: '#9ca3af', paddingRight: '12px', paddingBottom: '3px' }}>Mã tham chiếu:</td>
                    <td style={{ fontWeight: 500, paddingBottom: '3px', fontFamily: 'monospace' }}>{ret.referenceCode}</td>
                  </tr>
                )}
                {ret.documentDate && (
                  <tr>
                    <td style={{ color: '#9ca3af', paddingRight: '12px', paddingBottom: '3px' }}>Ngày chứng từ:</td>
                    <td style={{ fontWeight: 500, paddingBottom: '3px' }}>{fmtDt(ret.documentDate)}</td>
                  </tr>
                )}
                {ret.createdBy && (
                  <tr>
                    <td style={{ color: '#9ca3af', paddingRight: '12px', paddingBottom: '3px' }}>Nhân viên:</td>
                    <td style={{ fontWeight: 500, paddingBottom: '3px' }}>{ret.createdBy.fullName || ret.createdBy.username}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>
              Khách hàng
            </div>
            {ret.customer ? (
              <>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>{ret.customer.name}</div>
                {ret.customer.phone && (
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{ret.customer.phone}</div>
                )}
              </>
            ) : (
              <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>Khách lẻ</div>
            )}
            {ret.reason && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>Lý do trả hàng:</div>
                <div style={{ fontSize: '12px', color: '#374151' }}>{ret.reason}</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Bảng sản phẩm trả ── */}
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
          Sản phẩm trả ({totalQty} cái)
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '8px' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e3a5f', color: 'white' }}>
              <th style={{ border: '1px solid #374151', padding: '5px 8px', textAlign: 'left', width: '28px' }}>STT</th>
              <th style={{ border: '1px solid #374151', padding: '5px 8px', textAlign: 'left' }}>Tên sản phẩm</th>
              <th style={{ border: '1px solid #374151', padding: '5px 8px', textAlign: 'left', width: '80px' }}>Mã SP</th>
              <th style={{ border: '1px solid #374151', padding: '5px 8px', textAlign: 'center', width: '44px' }}>ĐVT</th>
              <th style={{ border: '1px solid #374151', padding: '5px 8px', textAlign: 'center', width: '36px' }}>SL</th>
              <th style={{ border: '1px solid #374151', padding: '5px 8px', textAlign: 'right', width: '90px' }}>Đơn giá trả</th>
              <th style={{ border: '1px solid #374151', padding: '5px 8px', textAlign: 'center', width: '70px' }}>Tình trạng</th>
              <th style={{ border: '1px solid #374151', padding: '5px 8px', textAlign: 'right', width: '90px' }}>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {ret.items.map((item, idx) => (
              <tr key={item.id} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', textAlign: 'center', color: '#6b7280' }}>{idx + 1}</td>
                <td style={{ border: '1px solid #d1d5db', padding: '4px 8px' }}>
                  <div style={{ fontWeight: 500 }}>{item.productName}</div>
                  {item.itemReason && <div style={{ fontSize: '10px', color: '#9ca3af' }}>{item.itemReason}</div>}
                </td>
                <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', color: '#6b7280', fontFamily: 'monospace' }}>{item.productCode}</td>
                <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', textAlign: 'center', color: '#6b7280' }}>{item.unit || '—'}</td>
                <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', textAlign: 'right' }}>{fmt(item.unitPrice)}</td>
                <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', textAlign: 'center', fontSize: '10px', color: '#6b7280' }}>
                  {CONDITION_LABEL[item.condition] ?? item.condition}
                </td>
                <td style={{ border: '1px solid #d1d5db', padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>
                  {fmt(item.refundAmount * item.quantity)}đ
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Tổng SP trả */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '48px', fontSize: '12px', marginBottom: isExchange && ret.exchangeItems?.length > 0 ? '16px' : '4px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <div style={{ display: 'flex', gap: '48px' }}>
              <span style={{ color: '#6b7280' }}>Số lượng trả</span>
              <span style={{ fontWeight: 500, minWidth: '80px', textAlign: 'right' }}>{totalQty} cái</span>
            </div>
            <div style={{ display: 'flex', gap: '48px', paddingTop: '4px', borderTop: '1.5px solid #374151' }}>
              <span style={{ fontWeight: 700 }}>Tổng tiền cần hoàn</span>
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#dc2626', minWidth: '80px', textAlign: 'right' }}>
                {fmt(ret.totalRefund)}đ
              </span>
            </div>
          </div>
        </div>

        {/* ── Bảng sản phẩm đổi (nếu có) ── */}
        {isExchange && ret.exchangeItems?.length > 0 && (
          <>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', marginTop: '4px' }}>
              Sản phẩm đổi ({ret.exchangeItems.reduce((s, i) => s + i.quantity, 0)} cái)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '8px' }}>
              <thead>
                <tr style={{ backgroundColor: '#1e40af', color: 'white' }}>
                  <th style={{ border: '1px solid #374151', padding: '5px 8px', textAlign: 'left', width: '28px' }}>STT</th>
                  <th style={{ border: '1px solid #374151', padding: '5px 8px', textAlign: 'left' }}>Tên sản phẩm</th>
                  <th style={{ border: '1px solid #374151', padding: '5px 8px', textAlign: 'left', width: '80px' }}>Mã SP</th>
                  <th style={{ border: '1px solid #374151', padding: '5px 8px', textAlign: 'center', width: '44px' }}>ĐVT</th>
                  <th style={{ border: '1px solid #374151', padding: '5px 8px', textAlign: 'center', width: '36px' }}>SL</th>
                  <th style={{ border: '1px solid #374151', padding: '5px 8px', textAlign: 'right', width: '90px' }}>Đơn giá</th>
                  <th style={{ border: '1px solid #374151', padding: '5px 8px', textAlign: 'right', width: '90px' }}>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {ret.exchangeItems.map((item, idx) => (
                  <tr key={item.id} style={{ backgroundColor: idx % 2 === 0 ? '#eff6ff' : '#dbeafe' }}>
                    <td style={{ border: '1px solid #bfdbfe', padding: '4px 8px', textAlign: 'center', color: '#6b7280' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #bfdbfe', padding: '4px 8px', fontWeight: 500 }}>{item.productName}</td>
                    <td style={{ border: '1px solid #bfdbfe', padding: '4px 8px', color: '#6b7280', fontFamily: 'monospace' }}>{item.productCode}</td>
                    <td style={{ border: '1px solid #bfdbfe', padding: '4px 8px', textAlign: 'center', color: '#6b7280' }}>{item.unit || '—'}</td>
                    <td style={{ border: '1px solid #bfdbfe', padding: '4px 8px', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                    <td style={{ border: '1px solid #bfdbfe', padding: '4px 8px', textAlign: 'right' }}>{fmt(item.unitPrice)}đ</td>
                    <td style={{ border: '1px solid #bfdbfe', padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: '#1d4ed8' }}>{fmt(item.lineTotal)}đ</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '48px', fontSize: '12px', marginBottom: '12px' }}>
              <span style={{ color: '#6b7280' }}>Tổng tiền hàng đổi</span>
              <span style={{ fontWeight: 700, color: '#1d4ed8', minWidth: '80px', textAlign: 'right' }}>{fmt(totalExchange)}đ</span>
            </div>
          </>
        )}

        {/* Ghi chú */}
        {ret.notes && (
          <div style={{ marginBottom: '16px', fontSize: '12px' }}>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: '3px', fontSize: '11px', textTransform: 'uppercase' }}>Ghi chú:</div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', padding: '6px 8px', color: '#4b5563', lineHeight: 1.5 }}>
              {ret.notes}
            </div>
          </div>
        )}

        {/* HTML printFooter (nếu có — cài đặt sau) */}
        {store?.printFooter && (
          <div style={{ marginBottom: '16px' }} dangerouslySetInnerHTML={{ __html: store.printFooter }} />
        )}

        {/* Chữ ký */}
        <hr style={{ borderColor: '#d1d5db', marginBottom: '16px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', textAlign: 'center', fontSize: '12px' }}>
          {['Người trả hàng', 'Người nhận hàng', 'Thủ kho'].map(role => (
            <div key={role}>
              <div style={{ fontWeight: 600, color: '#374151', marginBottom: '2px' }}>{role}</div>
              <div style={{ fontSize: '10px', color: '#9ca3af' }}>(Ký, ghi rõ họ tên)</div>
              <div style={{ marginTop: '48px', borderTop: '1px solid #6b7280', paddingTop: '4px', fontSize: '10px', color: '#d1d5db' }}>Họ và tên</div>
            </div>
          ))}
        </div>
      </div>
      <div className="no-print" style={{ height: '32px' }} />
    </>
  );
}
