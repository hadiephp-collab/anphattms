'use client';
import { useState, useEffect, useCallback } from 'react';
import { orderSourcesApi, OrderSource, OrderSourceStats } from '@/lib/order-sources';

// ── Toast ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const show = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show };
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);
const fmtVnd = (n: number) =>
  n >= 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(1)}B₫`
  : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M₫`
  : `${fmt(n)}₫`;

const COLOR_PRESETS = [
  '#2563eb', '#0ea5e9', '#1d4ed8', '#16a34a',
  '#dc2626', '#d97706', '#7c3aed', '#db2777',
  '#0f766e', '#64748b',
];

// ── Modal thêm/sửa ────────────────────────────────────────────────────────────
function SourceModal({
  initial, onSave, onClose,
}: {
  initial?: OrderSource;
  onSave: (data: { name: string; color?: string; sortOrder?: number }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName]         = useState(initial?.name ?? '');
  const [color, setColor]       = useState(initial?.color ?? '#2563eb');
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr('Tên không được để trống'); return; }
    setSaving(true); setErr('');
    try {
      await onSave({ name: name.trim(), color: color || undefined, sortOrder });
      onClose();
    } catch (ex: any) { setErr(ex.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5">
        <h3 className="text-base font-semibold text-gray-800 mb-4">
          {initial ? 'Sửa nguồn bán hàng' : 'Thêm nguồn bán hàng'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tên nguồn *</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Zalo, Website, Shopee..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Màu badge</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c} type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color" value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-6 rounded border cursor-pointer"
                title="Chọn màu tùy chỉnh"
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="text-xs px-2.5 py-1 rounded-full font-medium text-white"
                style={{ backgroundColor: color }}
              >
                {name || 'Preview'}
              </span>
              <span className="text-xs text-gray-400">Preview</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Thứ tự hiển thị</label>
            <input
              type="number" min={0} value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-24 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {err && <p className="text-xs text-red-600">{err}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
              Hủy
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NguonBanHangPage() {
  const [stats, setStats] = useState<OrderSourceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | OrderSource | null>(null);
  const [confirmDel, setConfirmDel] = useState<OrderSource | null>(null);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { setStats(await orderSourcesApi.getStats()); }
    catch (e: any) { show(e.message, false); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data: { name: string; color?: string; sortOrder?: number }) {
    if (modal === 'create') {
      await orderSourcesApi.create(data);
      show('Đã thêm nguồn bán hàng');
    } else if (modal && typeof modal === 'object') {
      await orderSourcesApi.update(modal.id, data);
      show('Đã cập nhật');
    }
    load();
  }

  async function handleToggle(src: OrderSource) {
    try {
      await orderSourcesApi.update(src.id, { isActive: !src.isActive });
      show(src.isActive ? 'Đã tắt nguồn' : 'Đã bật nguồn');
      load();
    } catch (e: any) { show(e.message, false); }
  }

  async function handleDelete(src: OrderSource) {
    try {
      await orderSourcesApi.remove(src.id);
      show('Đã xóa nguồn bán hàng');
      setConfirmDel(null);
      load();
    } catch (e: any) { show(e.message, false); setConfirmDel(null); }
  }

  const sources = stats?.sources ?? [];

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-white text-sm shadow-lg ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nguồn Bán Hàng</h1>
          <p className="text-sm text-gray-400 mt-0.5">Cấu hình kênh bán hàng để gắn tag cho đơn hàng</p>
        </div>
        <button
          onClick={() => setModal('create')}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-3.5 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Thêm nguồn
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Tổng nguồn', value: stats?.total ?? '—', color: '#2563eb' },
          { label: 'Đang hoạt động', value: stats?.active ?? '—', color: '#16a34a' },
          { label: 'Nguồn hệ thống', value: stats ? sources.filter((s) => s.isSystem).length : '—', color: '#7c3aed' },
        ].map((c) => (
          <div key={c.label} className="bg-white border rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{c.label}</div>
            <div className="text-2xl font-bold" style={{ color: c.color }}>
              {loading ? '...' : c.value}
            </div>
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 text-xs text-blue-700">
        4 nguồn hệ thống (Tại quầy, Zalo, Facebook, Điện thoại) không thể xóa, chỉ tắt được.
        Nguồn bán hàng xuất hiện trong form tạo đơn và báo cáo doanh thu theo kênh.
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left w-20">Mã</th>
              <th className="px-4 py-3 text-left">Tên nguồn</th>
              <th className="px-4 py-3 text-center w-16">Thứ tự</th>
              <th className="px-4 py-3 text-right w-24">Số đơn</th>
              <th className="px-4 py-3 text-right w-32">Doanh thu</th>
              <th className="px-4 py-3 text-center w-24">Trạng thái</th>
              <th className="px-4 py-3 text-right w-28">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">Đang tải...</td></tr>
            ) : sources.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">Chưa có nguồn bán hàng</td></tr>
            ) : sources.map((src) => (
              <tr key={src.id} className={`hover:bg-gray-50 ${!src.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{src.code}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs px-2.5 py-0.5 rounded-full font-medium text-white"
                      style={{ backgroundColor: src.color ?? '#64748b' }}
                    >
                      {src.name}
                    </span>
                    {src.isSystem && (
                      <span className="text-[10px] text-gray-400 border border-gray-200 rounded px-1">HT</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-gray-500">{src.sortOrder}</td>
                <td className="px-4 py-3 text-right">{fmt(src.orderCount ?? 0)}</td>
                <td className="px-4 py-3 text-right text-blue-700 font-medium">{fmtVnd(src.revenue ?? 0)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${src.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {src.isActive ? 'Hoạt động' : 'Tắt'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setModal(src)}
                    className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => handleToggle(src)}
                    className={`text-xs px-2 py-1 rounded ml-1 ${src.isActive ? 'text-gray-500 hover:text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}
                  >
                    {src.isActive ? 'Tắt' : 'Bật'}
                  </button>
                  {!src.isSystem && !src.isActive && (
                    <button
                      onClick={() => setConfirmDel(src)}
                      className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded ml-1"
                    >
                      Xóa
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {modal && (
        <SourceModal
          initial={modal === 'create' ? undefined : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5">
            <h3 className="font-semibold text-gray-800 mb-2">Xóa nguồn bán hàng?</h3>
            <p className="text-sm text-gray-500 mb-4">
              Nguồn <strong>{confirmDel.name}</strong> sẽ bị xóa vĩnh viễn.
              Thao tác này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDel(null)}
                className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={() => handleDelete(confirmDel)}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
