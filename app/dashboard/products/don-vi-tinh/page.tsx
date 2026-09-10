'use client';

import { useState, useEffect, useCallback } from 'react';
import { unitsApi, UnitOfMeasure, UnitStats, CreateUnitData, UpdateUnitData } from '@/lib/units';

type ToastType = 'success' | 'error';

const EMPTY_FORM: CreateUnitData = { code: '', name: '', description: '', sortOrder: 0, isDefault: false };

export default function DonViTinhPage() {
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [stats, setStats] = useState<UnitStats>({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CreateUnitData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [confirmTarget, setConfirmTarget] = useState<UnitOfMeasure | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');

  const showToast = (msg: string, type: ToastType = 'success') => {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(''), 3000);
  };

  const load = useCallback(async (q = search) => {
    setLoading(true); setError('');
    try {
      const res = await unitsApi.getAll(q || undefined);
      setUnits(res.data);
      setStats(res.stats);
    } catch {
      setError('Không thể tải danh sách đơn vị tính');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(u: UnitOfMeasure) {
    setEditingId(u.id);
    setForm({ code: u.code, name: u.name, description: u.description ?? '', sortOrder: u.sortOrder, isDefault: u.isDefault });
    setFormError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Tên đơn vị tính là bắt buộc'); return; }
    if (!editingId && !form.code.trim()) { setFormError('Mã là bắt buộc'); return; }
    setSaving(true); setFormError('');
    try {
      if (editingId) {
        const dto: UpdateUnitData = { name: form.name, description: form.description || undefined, sortOrder: form.sortOrder, isDefault: form.isDefault };
        await unitsApi.update(editingId, dto);
        showToast('Đã cập nhật đơn vị tính');
      } else {
        await unitsApi.create({ ...form, code: form.code.toUpperCase() });
        showToast('Đã thêm đơn vị tính');
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      setFormError(e.message || 'Lỗi khi lưu');
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(u: UnitOfMeasure) {
    try {
      await unitsApi.setDefault(u.id);
      showToast(`Đã đặt "${u.name}" làm mặc định`);
      load();
    } catch (e: any) {
      showToast(e.message || 'Lỗi khi đặt mặc định', 'error');
    }
  }

  async function handleToggleActive(u: UnitOfMeasure) {
    if (u.isActive) {
      setConfirmTarget(u);
    } else {
      try {
        await unitsApi.update(u.id, { isActive: true });
        showToast(`Đã bật "${u.name}"`);
        load();
      } catch (e: any) {
        showToast(e.message || 'Lỗi', 'error');
      }
    }
  }

  async function confirmDeactivate() {
    if (!confirmTarget || deactivating) return;
    setDeactivating(true);
    try {
      await unitsApi.remove(confirmTarget.id);
      showToast(`Đã ẩn "${confirmTarget.name}"`);
      load();
    } catch (e: any) {
      showToast(e.message || 'Lỗi khi ẩn', 'error');
    } finally {
      setDeactivating(false);
      setConfirmTarget(null);
    }
  }

  const defaultUnit = units.find(u => u.isDefault);
  const activeCount = stats.active;

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Đơn Vị Tính</h1>
        <p className="text-sm text-gray-500 mt-0.5">Quản lý danh mục đơn vị đo lường dùng trong hệ thống</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-600 text-white rounded-xl p-4">
          <div className="text-base font-bold">{stats.total}</div>
          <div className="text-sm text-white/70 mt-0.5">Tổng đơn vị tính</div>
        </div>
        <div className="bg-green-500 text-white rounded-xl p-4">
          <div className="text-base font-bold">{activeCount}</div>
          <div className="text-sm text-white/70 mt-0.5">Đang hoạt động</div>
        </div>
        <div className={`${defaultUnit ? 'bg-blue-500' : 'bg-amber-500'} text-white rounded-xl p-4`}>
          <div className="text-base font-bold truncate">{defaultUnit ? defaultUnit.name : '—'}</div>
          <div className="text-sm text-white/70 mt-0.5">{defaultUnit ? 'Mặc định' : 'Chưa đặt mặc định'}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); load(e.target.value); }}
          placeholder="Tìm theo tên hoặc mã..."
          className="flex-1 max-w-xs h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white"
        />
        <button onClick={openCreate}
          className="h-9 px-4 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Thêm đơn vị tính
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Đang tải...</div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500">{error}
            <button onClick={() => load()} className="ml-2 underline">Thử lại</button>
          </div>
        ) : units.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">Chưa có đơn vị tính nào</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Mã</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tên</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Mô tả</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">Thứ tự</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Mặc định</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Trạng thái</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {units.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{u.code}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell max-w-xs truncate">{u.description ?? '—'}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{u.sortOrder}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => !u.isDefault && u.isActive && handleSetDefault(u)}
                      title={u.isDefault ? 'Đang là mặc định' : u.isActive ? 'Đặt làm mặc định' : 'Không thể đặt mặc định cho ĐVT đang ẩn'}
                      className={`text-xl leading-none transition-colors ${u.isDefault ? 'text-amber-400 cursor-default' : u.isActive ? 'text-gray-300 hover:text-amber-400 cursor-pointer' : 'text-gray-200 cursor-not-allowed'}`}>
                      {u.isDefault ? '★' : '☆'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.isActive ? 'Hoạt động' : 'Đã ẩn'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => openEdit(u)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Sửa">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {u.isActive ? (
                        <button
                          onClick={() => handleToggleActive(u)}
                          disabled={activeCount <= 1}
                          title={activeCount <= 1 ? 'Không thể ẩn đơn vị tính duy nhất' : 'Ẩn'}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                          </svg>
                        </button>
                      ) : (
                        <button onClick={() => handleToggleActive(u)}
                          title="Hiện lại"
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{editingId ? 'Sửa đơn vị tính' : 'Thêm đơn vị tính'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Code — chỉ hiện khi tạo mới */}
              {!editingId && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Mã đơn vị tính <span className="text-red-500">*</span>
                    <span className="text-gray-400 font-normal ml-1">(viết tắt, tự động in hoa)</span>
                  </label>
                  <input value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="VD: CAI, KG, HOP"
                    maxLength={20}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-blue-400" />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Tên đơn vị tính <span className="text-red-500">*</span>
                </label>
                <input value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="VD: Cái, Kilogram, Hộp"
                  maxLength={100}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mô tả</label>
                <input value={form.description ?? ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Mô tả ngắn (tùy chọn)"
                  maxLength={200}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Thứ tự hiển thị</label>
                  <input type="number" min={0} value={form.sortOrder ?? 0}
                    onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.isDefault ?? false}
                      onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
                      className="w-4 h-4 rounded accent-blue-600" />
                    <span className="text-sm text-gray-700">Đặt làm mặc định</span>
                  </label>
                </div>
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} disabled={saving}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Hủy
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Deactivate Dialog */}
      {confirmTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Ẩn đơn vị tính?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Đơn vị tính <strong>"{confirmTarget.name}"</strong> sẽ bị ẩn khỏi dropdown chọn trong các form.
                  Các sản phẩm đã dùng không bị ảnh hưởng.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmTarget(null)} disabled={deactivating}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Hủy
              </button>
              <button onClick={confirmDeactivate} disabled={deactivating}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                {deactivating && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                {deactivating ? 'Đang xử lý...' : 'Ẩn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-2 transition-all ${toastType === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toastType === 'success'
            ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          }
          {toast}
        </div>
      )}
    </div>
  );
}
