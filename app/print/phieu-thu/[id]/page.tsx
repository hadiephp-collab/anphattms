'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { transactionsApi } from '@/lib/transactions';
import { settingsApi, StoreSetting } from '@/lib/settings';

interface Tx {
  id: number; code: string; type: string;
  amount: number; paymentMethod: string; category: string | null;
  note: string | null; date: string | null; createdAt: string;
  partner?: { id: number; name: string; code?: string } | null;
  branchEntity?: { id: number; name: string } | null;
  createdBy?: { id: number; fullName: string } | null;
  order?: { id: number; code: string } | null;
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtDatetime = (s: string | null) => s ? new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const PM: Record<string, string> = {
  cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', momo: 'MoMo', TM: 'Tiền mặt', CK: 'Chuyển khoản', MM: 'MoMo', other: 'Khác',
};

export default function PrintPhieuThuPage() {
  const { id } = useParams<{ id: string }>();
  const [tx, setTx] = useState<Tx | null>(null);
  const [settings, setSettings] = useState<StoreSetting | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      transactionsApi.getOne(Number(id)).catch(() => null),
      settingsApi.get().catch(() => null),
    ]).then(([t, s]) => {
      setTx(t as Tx | null);
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
  if (!tx) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial', color: '#f00', fontSize: 14 }}>Không tìm thấy phiếu thu</div>;

  const store = settings;

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#000', background: '#fff', minHeight: '100vh' }}>
      {/* Toolbar */}
      <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: '#1a1d2e', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 100 }}>
        <button onClick={() => window.print()} style={{ padding: '6px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>🖨 In ngay</button>
        <button onClick={() => window.close()} style={{ padding: '6px 16px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>✕ Đóng</button>
        <span style={{ color: '#9ca3af', fontSize: 12 }}>Ctrl+P để in thủ công</span>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '52px 0 32px' }}>
        <style>{`@media print { .no-print { display: none !important; } div[style*="52px"] { padding-top: 0 !important; } }`}</style>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottom: '2px solid #000', paddingBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{store?.storeName || 'An Phát TMS'}</div>
            {store?.storeAddress && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{store.storeAddress}</div>}
            {store?.storePhone && <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>ĐT: {store.storePhone}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 17, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Phiếu Thu</div>
            <div style={{ fontSize: 12, fontFamily: 'monospace', marginTop: 4, fontWeight: 600 }}>{tx.code}</div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
              {fmtDate(tx.date || tx.createdAt)}
            </div>
          </div>
        </div>

        {/* Info grid */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 12 }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px 0', color: '#555', width: 160, verticalAlign: 'top' }}>Người nộp tiền:</td>
              <td style={{ padding: '4px 0', fontWeight: 600 }}>{tx.partner?.name || '—'}</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 0', color: '#555', verticalAlign: 'top' }}>Lý do thu:</td>
              <td style={{ padding: '4px 0' }}>{tx.category || tx.note || '—'}</td>
            </tr>
            {tx.note && tx.category && (
              <tr>
                <td style={{ padding: '4px 0', color: '#555', verticalAlign: 'top' }}>Ghi chú:</td>
                <td style={{ padding: '4px 0', color: '#555' }}>{tx.note}</td>
              </tr>
            )}
            {tx.order && (
              <tr>
                <td style={{ padding: '4px 0', color: '#555', verticalAlign: 'top' }}>Đơn hàng:</td>
                <td style={{ padding: '4px 0', fontFamily: 'monospace', color: '#2563eb' }}>{tx.order.code}</td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '4px 0', color: '#555', verticalAlign: 'top' }}>PTTT:</td>
              <td style={{ padding: '4px 0' }}>{PM[tx.paymentMethod] || tx.paymentMethod}</td>
            </tr>
            {tx.branchEntity && (
              <tr>
                <td style={{ padding: '4px 0', color: '#555', verticalAlign: 'top' }}>Chi nhánh:</td>
                <td style={{ padding: '4px 0' }}>{tx.branchEntity.name}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Amount */}
        <div style={{ border: '1px solid #000', borderRadius: 4, padding: '14px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>SỐ TIỀN THU:</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>{fmt(Number(tx.amount))}</div>
        </div>

        {/* Bằng chữ */}
        <div style={{ fontStyle: 'italic', fontSize: 11, color: '#444', marginBottom: 20 }}>
          Bằng chữ: Xem trên phần mềm An Phát TMS
        </div>

        {/* Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 20, textAlign: 'center', fontSize: 12 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Người nộp</div>
            <div style={{ fontSize: 10, color: '#777', marginBottom: 44 }}>(Ký, ghi rõ họ tên)</div>
            <div style={{ borderTop: '1px solid #999', paddingTop: 4, fontSize: 10, color: '#555' }}>{tx.partner?.name || ''}</div>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Thủ quỹ</div>
            <div style={{ fontSize: 10, color: '#777', marginBottom: 44 }}>(Ký, ghi rõ họ tên)</div>
            <div style={{ borderTop: '1px solid #999', paddingTop: 4, fontSize: 10, color: '#555' }}></div>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Người lập</div>
            <div style={{ fontSize: 10, color: '#777', marginBottom: 44 }}>(Ký, ghi rõ họ tên)</div>
            <div style={{ borderTop: '1px solid #999', paddingTop: 4, fontSize: 10, color: '#555' }}>{tx.createdBy?.fullName || ''}</div>
          </div>
        </div>

        {/* Footer */}
        {(store?.printFooter) && (
          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 10, color: '#888', borderTop: '1px dashed #ccc', paddingTop: 8 }}>
            {store.printFooter}
          </div>
        )}

        {/* Print time */}
        <div style={{ marginTop: 12, fontSize: 9, color: '#bbb', textAlign: 'right' }}>
          In lúc: {fmtDatetime(new Date().toISOString())}
        </div>
      </div>
    </div>
  );
}
