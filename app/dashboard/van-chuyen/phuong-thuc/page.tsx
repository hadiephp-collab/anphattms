'use client';

import { useEffect, useState, useCallback } from 'react';
import { shippingApi, ShippingCarrier, CarrierType } from '@/lib/shipping';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<CarrierType, string> = { b2b: 'B2B', cod: 'COD', both: 'B2B + COD' };
const TYPE_COLOR: Record<CarrierType, string> = {
  b2b: 'bg-blue-100 text-blue-700',
  cod: 'bg-purple-100 text-purple-700',
  both: 'bg-teal-100 text-teal-700',
};

// ─── Carrier Form Modal ───────────────────────────────────────────────────────

function CarrierModal({
  carrier,
  onClose,
  onSaved,
}: {
  carrier?: ShippingCarrier;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!carrier;
  const [name, setName] = useState(carrier?.name ?? '');
  const [type, setType] = useState<CarrierType>(carrier?.type ?? 'both');
  const [description, setDescription] = useState(carrier?.description ?? '');
  const [contactPhone, setContactPhone] = useState(carrier?.contactPhone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Vui lòng nhập tên đơn vị VC'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        type,
        description: description.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
      };
      if (isEdit) {
        await shippingApi.updateCarrier(carrier.id, payload);
      } else {
        await shippingApi.createCarrier(payload);
      }
      onSaved();
    } catch (err: any) {
      setError(err.message ?? 'Lỗi khi lưu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? 'Sửa Đơn Vị VC' : 'Thêm Đơn Vị VC'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên đơn vị <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="GHTK, GHN, Viettel Post, Tự giao..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loại</label>
            <div className="flex gap-2">
              {(['b2b', 'cod', 'both'] as CarrierType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                    type === t
                      ? TYPE_COLOR[t] + ' border-transparent'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SĐT liên hệ</label>
            <input
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="0901 234 567"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Giao nhanh nội thành, COD toàn quốc..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50 transition">Hủy</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60">
              {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PhuongThucVCPage() {
  const [carriers, setCarriers] = useState<ShippingCarrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ShippingCarrier | undefined>();
  const [toast, setToast] = useState('');
  const [toastErr, setToastErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await shippingApi.getCarriers();
      setCarriers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string, err = false) => {
    if (err) setToastErr(msg); else setToast(msg);
    setTimeout(() => { setToast(''); setToastErr(''); }, 3000);
  };

  const handleToggle = async (c: ShippingCarrier) => {
    if (c.isActive && !confirm(`Tắt "${c.name}"? Sẽ không thể tạo vận đơn mới với đơn vị này.`)) return;
    try {
      await shippingApi.updateCarrier(c.id, { isActive: !c.isActive });
      showToast(c.isActive ? 'Đã tắt đơn vị vận chuyển' : 'Đã bật đơn vị vận chuyển');
      load();
    } catch (err: any) {
      showToast(err.message ?? 'Lỗi', true);
    }
  };

  // KPI
  const total = carriers.length;
  const active = carriers.filter((c) => c.isActive).length;
  const b2bCount = carriers.filter((c) => c.type === 'b2b' || c.type === 'both').length;
  const codCount = carriers.filter((c) => c.type === 'cod' || c.type === 'both').length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Toast */}
      {toast && <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}
      {toastErr && <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toastErr}</div>}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Phương Thức Vận Chuyển</h1>
          <p className="text-sm text-gray-500 mt-0.5">Quản lý đơn vị VC và phương thức giao hàng</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowModal(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2"
        >
          <span className="text-lg leading-none">+</span>
          Thêm mới
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Tổng', value: total, color: 'bg-gray-600' },
          { label: 'Đang hoạt động', value: active, color: 'bg-green-500' },
          { label: 'Hỗ trợ B2B', value: b2bCount, color: 'bg-blue-500' },
          { label: 'Hỗ trợ COD', value: codCount, color: 'bg-purple-500' },
        ].map((k) => (
          <div key={k.label} className={`${k.color} text-white rounded-xl p-4`}>
            <p className="text-xs font-medium opacity-80 uppercase tracking-wide">{k.label}</p>
            <p className="text-3xl font-bold mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Đang tải...</div>
        ) : carriers.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">Chưa có đơn vị vận chuyển nào</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Mã</th>
                <th className="text-left px-4 py-3">Tên đơn vị</th>
                <th className="text-left px-4 py-3">Loại</th>
                <th className="text-left px-4 py-3">SĐT</th>
                <th className="text-left px-4 py-3">Mô tả</th>
                <th className="text-right px-4 py-3">Vận đơn</th>
                <th className="text-left px-4 py-3">Trạng thái</th>
                <th className="text-left px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {carriers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition text-sm">
                  <td className="px-4 py-3 font-mono text-blue-600 text-xs">{c.code}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLOR[c.type]}`}>
                      {TYPE_LABEL[c.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.contactPhone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{c.description ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700 font-medium">{c.shipmentCount}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.isActive ? 'Hoạt động' : 'Tắt'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditing(c); setShowModal(true); }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleToggle(c)}
                        className={`text-xs font-medium ${c.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}
                      >
                        {c.isActive ? 'Tắt' : 'Bật'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <CarrierModal
          carrier={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); showToast(editing ? 'Đã cập nhật' : 'Đã thêm mới'); }}
        />
      )}
    </div>
  );
}
