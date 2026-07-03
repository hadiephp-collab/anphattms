'use client';

import { useEffect, useState } from 'react';
import { settingsApi, StoreSetting } from '@/lib/settings';

const TABS = [
  { key: 'hoa-don', label: 'Hóa đơn bán hàng' },
  { key: 'phieu-thu', label: 'Phiếu thu' },
  { key: 'phieu-chi', label: 'Phiếu chi' },
] as const;
type Tab = typeof TABS[number]['key'];

const PM: Record<string, string> = { cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', momo: 'MoMo', TM: 'Tiền mặt', CK: 'Chuyển khoản' };
const fmt = (n: number) => Number(n).toLocaleString('vi-VN') + 'đ';

const DEMO_ITEMS = [
  { productCode: 'SP001', productName: 'Kính hàn điện tử R100', unit: 'Cái', quantity: 2, unitPrice: 850000, discountPercent: 0, lineTotal: 1700000 },
  { productCode: 'SP002', productName: 'Máy cắt plasma CUT50', unit: 'Chiếc', quantity: 1, unitPrice: 5200000, discountPercent: 5, lineTotal: 4940000 },
];
const DEMO_TX = { code: 'PT-240701-001', partner: 'Công ty TNHH ABC', category: 'Thu tiền hàng', paymentMethod: 'TM', amount: 6640000, staff: 'Nguyễn Văn A' };

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'}`}>
      {type === 'success' ? '✓' : '✕'} {msg}
    </div>
  );
}

function PreviewHoaDon({ s }: { s: Partial<StoreSetting> }) {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#000', background: '#fff', padding: '20px 24px', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, borderBottom: '2px solid #000', paddingBottom: 8 }}>
        <div>
          {s.logoUrl && <img src={s.logoUrl} alt="Logo" style={{ height: 36, objectFit: 'contain', marginBottom: 4, display: 'block' }} />}
          <div style={{ fontWeight: 700, fontSize: 13 }}>{s.storeName || 'An Phát TMS'}</div>
          {s.storeAddress && <div style={{ color: '#555', fontSize: 10, marginTop: 1 }}>{s.storeAddress}</div>}
          {s.storePhone && <div style={{ color: '#555', fontSize: 10 }}>ĐT: {s.storePhone}</div>}
          {s.taxCode && <div style={{ color: '#555', fontSize: 10 }}>MST: {s.taxCode}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase' }}>Hóa Đơn Bán Hàng</div>
          <div style={{ fontSize: 11, fontFamily: 'monospace', marginTop: 3 }}><strong>Số:</strong> DH-240701-001</div>
          <div style={{ fontSize: 10, color: '#555' }}><strong>Ngày:</strong> 01/07/2026</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', marginBottom: 10, fontSize: 10 }}>
        <div><strong>Khách hàng:</strong> Công ty TNHH ABC</div>
        <div><strong>SĐT:</strong> 0901 234 567</div>
        <div><strong>Nhân viên:</strong> Nguyễn Văn A</div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10, fontSize: 10 }}>
        <thead>
          <tr style={{ background: '#f5f5f5', borderTop: '1px solid #ccc', borderBottom: '1px solid #ccc' }}>
            <th style={{ padding: '4px 6px', textAlign: 'center', width: 22 }}>STT</th>
            <th style={{ padding: '4px 6px', textAlign: 'left' }}>Tên sản phẩm</th>
            <th style={{ padding: '4px 6px', textAlign: 'center', width: 28 }}>ĐVT</th>
            <th style={{ padding: '4px 6px', textAlign: 'center', width: 28 }}>SL</th>
            <th style={{ padding: '4px 6px', textAlign: 'right', width: 80 }}>Đơn giá</th>
            <th style={{ padding: '4px 6px', textAlign: 'right', width: 90 }}>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {DEMO_ITEMS.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '3px 6px', textAlign: 'center', color: '#777' }}>{i + 1}</td>
              <td style={{ padding: '3px 6px' }}><div style={{ fontWeight: 500 }}>{item.productName}</div><div style={{ fontSize: 9, color: '#888' }}>{item.productCode}</div></td>
              <td style={{ padding: '3px 6px', textAlign: 'center' }}>{item.unit}</td>
              <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
              <td style={{ padding: '3px 6px', textAlign: 'right' }}>{Number(item.unitPrice).toLocaleString('vi-VN')}</td>
              <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 600 }}>{Number(item.lineTotal).toLocaleString('vi-VN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <table style={{ minWidth: 200, fontSize: 10 }}>
          <tbody>
            <tr><td style={{ padding: '2px 6px', color: '#555' }}>Tạm tính:</td><td style={{ padding: '2px 6px', textAlign: 'right' }}>{fmt(6900000)}</td></tr>
            <tr><td style={{ padding: '2px 6px', color: '#555' }}>Giảm giá:</td><td style={{ padding: '2px 6px', textAlign: 'right', color: '#dc2626' }}>- {fmt(260000)}</td></tr>
            <tr style={{ borderTop: '1.5px solid #000' }}>
              <td style={{ padding: '5px 6px', fontWeight: 700, fontSize: 11 }}>TỔNG TIỀN:</td>
              <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, fontSize: 12 }}>{fmt(6640000)}</td>
            </tr>
            <tr><td style={{ padding: '2px 6px', color: '#16a34a' }}>Đã thanh toán:</td><td style={{ padding: '2px 6px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{fmt(6640000)}</td></tr>
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 9, fontStyle: 'italic', color: '#444', marginBottom: 10 }}>Bằng chữ: Sáu triệu sáu trăm bốn mươi nghìn đồng</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 14, textAlign: 'center', fontSize: 10 }}>
        {['Người mua hàng', 'Người bán hàng'].map((label, i) => (
          <div key={i}>
            <div style={{ fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 8, color: '#777', margin: '2px 0 24px' }}>(Ký, ghi rõ họ tên)</div>
            <div style={{ borderTop: '1px solid #999', paddingTop: 3, fontStyle: 'italic', color: '#555' }}>{i === 0 ? 'Công ty TNHH ABC' : 'Nguyễn Văn A'}</div>
          </div>
        ))}
      </div>
      {s.printFooter && <div style={{ marginTop: 14, textAlign: 'center', fontSize: 9, color: '#888', borderTop: '1px dashed #ccc', paddingTop: 6 }}>{s.printFooter}</div>}
    </div>
  );
}

function PreviewPhieu({ s, ischu }: { s: Partial<StoreSetting>; ischu: boolean }) {
  const t = DEMO_TX;
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#000', background: '#fff', padding: '20px 24px', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, borderBottom: '2px solid #000', paddingBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{s.storeName || 'An Phát TMS'}</div>
          {s.storeAddress && <div style={{ color: '#555', fontSize: 10, marginTop: 1 }}>{s.storeAddress}</div>}
          {s.storePhone && <div style={{ color: '#555', fontSize: 10 }}>ĐT: {s.storePhone}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase' }}>{ischu ? 'Phiếu Chi' : 'Phiếu Thu'}</div>
          <div style={{ fontSize: 11, fontFamily: 'monospace', marginTop: 3, fontWeight: 600 }}>{t.code}</div>
          <div style={{ fontSize: 10, color: '#555' }}>01/07/2026</div>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 10 }}>
        <tbody>
          <tr><td style={{ padding: '3px 0', color: '#555', width: 140 }}>{ischu ? 'Người nhận tiền:' : 'Người nộp tiền:'}</td><td style={{ fontWeight: 600 }}>{t.partner}</td></tr>
          <tr><td style={{ padding: '3px 0', color: '#555' }}>{ischu ? 'Lý do chi:' : 'Lý do thu:'}</td><td>{t.category}</td></tr>
          <tr><td style={{ padding: '3px 0', color: '#555' }}>PTTT:</td><td>{PM[t.paymentMethod] || t.paymentMethod}</td></tr>
        </tbody>
      </table>
      <div style={{ border: '1px solid #000', borderRadius: 4, padding: '10px 12px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 600 }}>SỐ TIỀN {ischu ? 'CHI' : 'THU'}:</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: ischu ? '#dc2626' : '#16a34a' }}>{fmt(t.amount)}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 16, textAlign: 'center', fontSize: 10 }}>
        {[ischu ? 'Người nhận' : 'Người nộp', 'Thủ quỹ', 'Người lập'].map((label, i) => (
          <div key={i}>
            <div style={{ fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 8, color: '#777', margin: '2px 0 24px' }}>(Ký, ghi rõ họ tên)</div>
            <div style={{ borderTop: '1px solid #999', paddingTop: 3 }}>{i === 2 ? t.staff : ''}</div>
          </div>
        ))}
      </div>
      {s.printFooter && <div style={{ marginTop: 14, textAlign: 'center', fontSize: 9, color: '#888', borderTop: '1px dashed #ccc', paddingTop: 6 }}>{s.printFooter}</div>}
    </div>
  );
}

export default function MauInPage() {
  const [tab, setTab] = useState<Tab>('hoa-don');
  const [form, setForm] = useState({
    storeName: '', storeAddress: '', storePhone: '', taxCode: '', logoUrl: '', printFooter: '',
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [baseSettings, setBaseSettings] = useState<Partial<StoreSetting>>({});

  useEffect(() => {
    settingsApi.get().then(s => {
      setBaseSettings(s);
      setForm({
        storeName: s.storeName || '',
        storeAddress: s.storeAddress || '',
        storePhone: s.storePhone || '',
        taxCode: s.taxCode || '',
        logoUrl: s.logoUrl || '',
        printFooter: s.printFooter || '',
      });
    }).catch(() => {});
  }, []);

  const previewSettings: Partial<StoreSetting> = { ...baseSettings, ...form };

  async function handleSave() {
    setSaving(true);
    try {
      await settingsApi.update({
        storeName: form.storeName || undefined,
        storeAddress: form.storeAddress || undefined,
        storePhone: form.storePhone || undefined,
        taxCode: form.taxCode || undefined,
        logoUrl: form.logoUrl || undefined,
        printFooter: form.printFooter || undefined,
      });
      setBaseSettings(prev => ({ ...prev, ...form }));
      setToast({ msg: 'Đã lưu cài đặt mẫu in', type: 'success' });
    } catch {
      setToast({ msg: 'Lưu thất bại, vui lòng thử lại', type: 'error' });
    }
    setSaving(false);
  }

  const FIELDS = [
    { field: 'storeName', label: 'Tên công ty', placeholder: 'An Phát TMS' },
    { field: 'storePhone', label: 'Số điện thoại', placeholder: '0901 234 567' },
    { field: 'taxCode', label: 'Mã số thuế', placeholder: '0123456789' },
    { field: 'logoUrl', label: 'URL Logo (https://...)', placeholder: 'https://example.com/logo.png' },
  ] as const;

  return (
    <div className="p-6 min-h-screen">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Mẫu In</h1>
          <p className="text-sm text-gray-400 mt-0.5">Tùy chỉnh thông tin công ty và footer trên phiếu in</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-60 transition">
          {saving ? 'Đang lưu...' : '💾 Lưu thay đổi'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-700 text-sm mb-4">Thông tin công ty</h2>
            <div className="space-y-3">
              {FIELDS.map(({ field, label, placeholder }) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input value={form[field]}
                    onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Địa chỉ</label>
                <textarea value={form.storeAddress}
                  onChange={e => setForm(prev => ({ ...prev, storeAddress: e.target.value }))}
                  placeholder="Số 123, Đường ABC, Quận 1, TP.HCM"
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-700 text-sm mb-4">Footer phiếu in</h2>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Dòng cuối mỗi phiếu</label>
              <input value={form.printFooter}
                onChange={e => setForm(prev => ({ ...prev, printFooter: e.target.value }))}
                placeholder="Cảm ơn quý khách! Mọi thắc mắc xin liên hệ 0901 234 567"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              <p className="text-xs text-gray-400 mt-1">Hiển thị ở cuối tất cả phiếu in</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <div className="font-semibold text-amber-700 text-sm mb-2">Cách in phiếu</div>
            <ul className="space-y-1 text-xs text-amber-600">
              <li>• <strong>Hóa đơn bán hàng</strong>: Chi tiết Đơn Hàng → nút "In đơn"</li>
              <li>• <strong>Phiếu Thu</strong>: Chi tiết Phiếu Thu → nút "In phiếu"</li>
              <li>• <strong>Phiếu Chi</strong>: Chi tiết Phiếu Chi → nút "In phiếu"</li>
            </ul>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-semibold text-gray-700 text-sm">Xem trước</h2>
            <div className="flex gap-1">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl transition ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-auto max-h-[580px] rounded-xl bg-gray-50 p-3">
            {tab === 'hoa-don' && <PreviewHoaDon s={previewSettings} />}
            {tab === 'phieu-thu' && <PreviewPhieu s={previewSettings} ischu={false} />}
            {tab === 'phieu-chi' && <PreviewPhieu s={previewSettings} ischu={true} />}
          </div>
        </div>
      </div>
    </div>
  );
}
