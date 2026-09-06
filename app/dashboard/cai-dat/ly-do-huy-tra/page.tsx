'use client';

import { useState, useEffect } from 'react';
import { cancelReturnReasonsApi, CancelReturnReason } from '@/lib/cancel-return-reasons';

type Tab = 'cancel' | 'return';

interface ModalState {
  open: boolean;
  mode: 'create' | 'edit';
  type: Tab;
  item?: CancelReturnReason;
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${ok ? 'bg-green-600' : 'bg-red-600'}`}>
      {msg}
    </div>
  );
}

export default function LyDoHuyTraPage() {
  const [tab, setTab] = useState<Tab>('cancel');
  const [cancelItems, setCancelItems] = useState<CancelReturnReason[]>([]);
  const [returnItems, setReturnItems] = useState<CancelReturnReason[]>([]);
  const [stats, setStats] = useState({ cancelTotal: 0, cancelActive: 0, returnTotal: 0, returnActive: 0 });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'create', type: 'cancel' });
  const [formName, setFormName] = useState('');
  const [formSort, setFormSort] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<CancelReturnReason | null>(null);
  const [deleting, setDeleting] = useState(false);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function load() {
    setLoading(true);
    try {
      const [c, r, s] = await Promise.all([
        cancelReturnReasonsApi.getAll({ type: 'cancel' }),
        cancelReturnReasonsApi.getAll({ type: 'return' }),
        cancelReturnReasonsApi.getStats(),
      ]);
      setCancelItems(c);
      setReturnItems(r);
      setStats(s);
    } catch {
      showToast('Không thể tải dữ liệu', false);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate(type: Tab) {
    const items = type === 'cancel' ? cancelItems : returnItems;
    const maxSort = items.length > 0 ? Math.max(...items.map(i => i.sortOrder)) + 1 : 0;
    setFormName('');
    setFormSort(maxSort);
    setModal({ open: true, mode: 'create', type });
  }

  function openEdit(item: CancelReturnReason) {
    setFormName(item.name);
    setFormSort(item.sortOrder);
    setModal({ open: true, mode: 'edit', type: item.type as Tab, item });
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (modal.mode === 'create') {
        await cancelReturnReasonsApi.create({ type: modal.type, name: formName.trim(), sortOrder: formSort });
        showToast('Đã thêm lý do');
      } else if (modal.item) {
        await cancelReturnReasonsApi.update(modal.item.id, { name: formName.trim(), sortOrder: formSort });
        showToast('Đã cập nhật lý do');
      }
      setModal(m => ({ ...m, open: false }));
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Lỗi lưu', false);
    }
    setSaving(false);
  }

  async function handleToggle(item: CancelReturnReason) {
    try {
      await cancelReturnReasonsApi.update(item.id, { isActive: !item.isActive });
      showToast(item.isActive ? 'Đã tắt' : 'Đã bật');
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Lỗi', false);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await cancelReturnReasonsApi.remove(deleteConfirm.id);
      showToast('Đã xóa');
      setDeleteConfirm(null);
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Lỗi xóa', false);
    }
    setDeleting(false);
  }

  const items = tab === 'cancel' ? cancelItems : returnItems;
  const tabLabel = tab === 'cancel' ? 'Hủy Đơn' : 'Trả Hàng';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lý Do Hủy / Trả Hàng</h1>
          <p className="text-sm text-gray-500 mt-0.5">Quản lý danh sách lý do cho form hủy đơn và trả hàng</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Lý do hủy đơn', value: stats.cancelTotal, sub: `${stats.cancelActive} hoạt động`, color: 'from-red-500 to-red-600' },
          { label: 'Đang bật (hủy)', value: stats.cancelActive, sub: `${stats.cancelTotal - stats.cancelActive} đang tắt`, color: 'from-orange-500 to-orange-600' },
          { label: 'Lý do trả hàng', value: stats.returnTotal, sub: `${stats.returnActive} hoạt động`, color: 'from-blue-500 to-blue-600' },
          { label: 'Đang bật (trả)', value: stats.returnActive, sub: `${stats.returnTotal - stats.returnActive} đang tắt`, color: 'from-indigo-500 to-indigo-600' },
        ].map(c => (
          <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-4 text-white`}>
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-xs font-medium opacity-90 mt-0.5">{c.label}</div>
            <div className="text-xs opacity-70 mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        {(['cancel', 'return'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'cancel' ? '🚫 Lý Do Hủy Đơn' : '↩️ Lý Do Trả Hàng'}
          </button>
        ))}
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">
            {tab === 'cancel' ? 'Danh sách lý do hủy đơn' : 'Danh sách lý do trả hàng'}
            <span className="ml-2 text-xs font-normal text-gray-400">({items.length})</span>
          </h2>
          <button onClick={() => openCreate(tab)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Thêm lý do
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Đang tải...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">Chưa có lý do nào</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3 text-left">Tên lý do</th>
                <th className="px-3 py-3 text-center">Thứ tự</th>
                <th className="px-3 py-3 text-center">Loại</th>
                <th className="px-3 py-3 text-center">Trạng thái</th>
                <th className="px-5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3 font-medium text-gray-900">
                    {item.name}
                    {item.isSystem && (
                      <span className="ml-2 px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded font-medium">HT</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-gray-500">{item.sortOrder}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.type === 'cancel' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {item.type === 'cancel' ? 'Hủy đơn' : 'Trả hàng'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.isActive ? 'Đang bật' : 'Đã tắt'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(item)}
                        className="px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition">
                        Sửa
                      </button>
                      <button onClick={() => handleToggle(item)}
                        className={`px-2.5 py-1 text-xs rounded-lg transition ${item.isActive ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}>
                        {item.isActive ? 'Tắt' : 'Bật'}
                      </button>
                      {!item.isSystem && (
                        <button onClick={() => setDeleteConfirm(item)}
                          className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg transition">
                          Xóa
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {items.some(i => i.isSystem) && (
          <p className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100">
            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium mr-1">HT</span>
            Lý do hệ thống — không thể xóa, chỉ có thể tắt
          </p>
        )}
      </div>

      {/* Create/Edit modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">
              {modal.mode === 'create' ? `Thêm lý do ${tabLabel.toLowerCase()}` : 'Sửa lý do'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tên lý do <span className="text-red-500">*</span></label>
                <input value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="VD: Khách đổi ý, Sản phẩm lỗi..."
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Thứ tự hiển thị</label>
                <input type="number" min={0} value={formSort} onChange={e => setFormSort(Number(e.target.value))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setModal(m => ({ ...m, open: false }))} disabled={saving}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition">Hủy</button>
              <button onClick={handleSave} disabled={saving || !formName.trim()}
                className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 transition">
                {saving ? 'Đang lưu...' : modal.mode === 'create' ? 'Thêm' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-5">
            <h3 className="font-semibold text-gray-900 mb-2">Xóa lý do</h3>
            <p className="text-sm text-gray-600 mb-4">
              Xóa <span className="font-medium">"{deleteConfirm.name}"</span>? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition">Hủy</button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl disabled:opacity-50 transition">
                {deleting ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}
