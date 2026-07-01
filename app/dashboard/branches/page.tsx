'use client';

import { useState, useEffect, useCallback } from 'react';
import { branchesApi, Branch, BranchFormData } from '@/lib/branches';
import { employeesApi } from '@/lib/employees';

const TIMEZONES = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Việt Nam (UTC+7)' },
  { value: 'Asia/Bangkok', label: 'Thái Lan (UTC+7)' },
  { value: 'Asia/Singapore', label: 'Singapore (UTC+8)' },
  { value: 'Asia/Shanghai', label: 'Trung Quốc (UTC+8)' },
  { value: 'UTC', label: 'UTC (UTC+0)' },
];

const EMPTY_FORM: BranchFormData = {
  name: '',
  address: '',
  phone: '',
  email: '',
  nguoiPhuTrach: '',
  soNhanVien: undefined,
  timezone: 'Asia/Ho_Chi_Minh',
  isActive: true,
  ghiChu: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ToastType = 'success' | 'error';

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<BranchFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [confirmTarget, setConfirmTarget] = useState<Branch | null>(null);

  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');

  const [employees, setEmployees] = useState<{ id: number; fullName: string }[]>([]);

  const showToast = (msg: string, type: ToastType = 'success') => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await branchesApi.getAll();
      setBranches(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    employeesApi.getAll({ isActive: 'true', limit: '200' })
      .then((res: any) => setEmployees((res.items ?? res).map((e: any) => ({ id: e.id, fullName: e.fullName }))))
      .catch(() => {});
  }, []);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(b: Branch) {
    setEditingId(b.id);
    setForm({
      name: b.name,
      address: b.address ?? '',
      phone: b.phone ?? '',
      email: b.email ?? '',
      nguoiPhuTrach: b.nguoiPhuTrach ?? '',
      soNhanVien: b.soNhanVien ?? undefined,
      timezone: b.timezone,
      isActive: b.isActive,
      ghiChu: b.ghiChu ?? '',
    });
    setFormError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name?.trim()) { setFormError('Tên chi nhánh là bắt buộc'); return; }
    const emailVal = form.email?.trim();
    if (emailVal && !EMAIL_RE.test(emailVal)) { setFormError('Email không hợp lệ'); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload: BranchFormData = {
        name: form.name?.trim(),
        address: form.address?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        email: emailVal || undefined,
        nguoiPhuTrach: form.nguoiPhuTrach?.trim() || undefined,
        soNhanVien: form.soNhanVien ?? undefined,
        timezone: form.timezone,
        ghiChu: form.ghiChu?.trim() || undefined,
        ...(editingId !== null ? { isActive: form.isActive } : {}),
      };
      if (editingId !== null) {
        await branchesApi.update(editingId, payload);
        showToast('Đã cập nhật chi nhánh');
      } else {
        await branchesApi.create(payload);
        showToast('Đã thêm chi nhánh mới');
      }
      setShowModal(false);
      load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Lỗi lưu dữ liệu');
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(id: number) {
    try {
      await branchesApi.setDefault(id);
      showToast('Đã đặt chi nhánh mặc định');
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Lỗi', 'error');
    }
  }

  async function confirmDeactivate() {
    if (!confirmTarget) return;
    try {
      await branchesApi.remove(confirmTarget.id);
      showToast(`Đã tắt chi nhánh "${confirmTarget.name}"`);
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Lỗi', 'error');
    } finally {
      setConfirmTarget(null);
    }
  }

  async function handleActivate(b: Branch) {
    try {
      await branchesApi.update(b.id, { isActive: true });
      showToast(`Đã kích hoạt chi nhánh "${b.name}"`);
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Lỗi', 'error');
    }
  }

  const active = branches.filter(b => b.isActive);
  const totalNV = branches.reduce((s, b) => s + (b.soNhanVien ?? 0), 0);
  const defaultBranch = branches.find(b => b.isDefault);
  const canDeactivate = (b: Branch) => b.isActive && active.length > 1;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Chi Nhánh</h1>
          <p className="text-sm text-gray-500 mt-0.5">Quản lý các chi nhánh / điểm bán của công ty</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Thêm chi nhánh
        </button>
      </div>

      {/* Warning: no default set */}
      {!loading && branches.length > 0 && !defaultBranch && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Chưa có chi nhánh mặc định. Hãy click biểu tượng ☆ để đặt mặc định cho một chi nhánh.</span>
        </div>
      )}

      {/* KPI bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Tổng chi nhánh</p>
              <p className="text-2xl font-bold mt-1 text-blue-600">{branches.length}</p>
            </div>
            <span className="text-2xl">🏢</span>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Đang hoạt động</p>
              <p className="text-2xl font-bold mt-1 text-green-600">{active.length}</p>
            </div>
            <span className="text-2xl">✅</span>
          </div>
        </div>
        <div className={`bg-white rounded-xl p-4 shadow-sm border ${defaultBranch ? 'border-gray-100' : 'border-amber-200 bg-amber-50'}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Mặc định</p>
              <p className={`text-base font-bold mt-1 truncate max-w-32 ${defaultBranch ? 'text-purple-600' : 'text-amber-500'}`}>
                {defaultBranch?.name || 'Chưa đặt'}
              </p>
            </div>
            <span className="text-2xl">{defaultBranch ? '⭐' : '⚠️'}</span>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Tổng nhân viên</p>
              <p className="text-2xl font-bold mt-1 text-orange-600">{totalNV}</p>
            </div>
            <span className="text-2xl">👥</span>
          </div>
        </div>
      </div>

      {/* Danh sách */}
      {(
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Đang tải...</div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-500 mb-3">{error}</p>
              <button onClick={load} className="text-sm text-blue-600 hover:underline">Thử lại</button>
            </div>
          ) : branches.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">🏢</div>
              <p className="text-gray-500 font-medium">Chưa có chi nhánh nào</p>
              <button onClick={openAdd} className="mt-3 text-blue-600 text-sm hover:underline">Thêm chi nhánh đầu tiên</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['#', 'Tên chi nhánh', 'Người phụ trách', 'Địa chỉ', 'SĐT', 'Số NV', 'Múi giờ', 'Mặc định', 'Trạng thái', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {branches.map((b, i) => (
                    <tr key={b.id} className={`hover:bg-gray-50 transition-colors ${!b.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{b.name}</div>
                        {b.email && <div className="text-xs text-gray-400">{b.email}</div>}
                        {b.ghiChu && <div className="text-xs text-gray-400 italic truncate max-w-48">{b.ghiChu}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{b.nguoiPhuTrach || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-48 truncate">{b.address || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{b.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-700 text-center">{b.soNhanVien ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{TIMEZONES.find(t => t.value === b.timezone)?.label ?? b.timezone}</td>
                      <td className="px-4 py-3 text-center">
                        {b.isDefault ? (
                          <span className="inline-flex items-center gap-1 text-yellow-600 font-semibold text-xs">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            Mặc định
                          </span>
                        ) : b.isActive ? (
                          <button onClick={() => handleSetDefault(b.id)}
                            className="text-gray-300 hover:text-yellow-400 transition-colors" title="Đặt làm mặc định">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          </button>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          b.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {b.isActive ? 'Hoạt động' : 'Tắt'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(b)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Sửa">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          {b.isActive ? (
                            <button
                              onClick={() => canDeactivate(b) ? setConfirmTarget(b) : showToast('Không thể tắt chi nhánh duy nhất đang hoạt động', 'error')}
                              className={`p-1.5 rounded-lg transition-colors ${
                                canDeactivate(b)
                                  ? 'text-orange-400 hover:text-orange-600 hover:bg-orange-50'
                                  : 'text-gray-200 cursor-not-allowed'
                              }`}
                              title={canDeactivate(b) ? 'Tắt chi nhánh' : 'Không thể tắt chi nhánh duy nhất'}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </button>
                          ) : (
                            <button onClick={() => handleActivate(b)}
                              className="p-1.5 text-green-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Kích hoạt lại">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal thêm/sửa */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">
                {editingId ? 'Sửa chi nhánh' : 'Thêm chi nhánh mới'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Tên chi nhánh <span className="text-red-500">*</span></label>
                <input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="VD: Chi Nhánh Hà Nội"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Người phụ trách</label>
                  <select value={form.nguoiPhuTrach ?? ''} onChange={e => setForm(f => ({ ...f, nguoiPhuTrach: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Chọn nhân viên —</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.fullName}>{emp.fullName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Số nhân viên</label>
                  <input type="number" min={0} value={form.soNhanVien ?? ''}
                    onChange={e => setForm(f => ({ ...f, soNhanVien: e.target.value ? +e.target.value : undefined }))}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Số điện thoại</label>
                  <input value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="0xxxxxxxxx"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@company.vn"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Địa chỉ</label>
                <input value={form.address ?? ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Số nhà, đường, quận, thành phố..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Múi giờ</label>
                <select value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Ghi chú</label>
                <textarea value={form.ghiChu ?? ''} onChange={e => setForm(f => ({ ...f, ghiChu: e.target.value }))}
                  rows={2} placeholder="Ghi chú nội bộ..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              {editingId !== null && (
                <div className={`p-3 rounded-lg ${!form.isActive ? 'bg-orange-50 border border-orange-100' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Trạng thái hoạt động</p>
                      <p className="text-xs text-gray-400">Tắt sẽ ẩn chi nhánh khỏi toàn bộ hệ thống</p>
                    </div>
                    <button type="button"
                      onClick={() => {
                        const willDeactivate = form.isActive;
                        const editingBranch = branches.find(b => b.id === editingId);
                        if (willDeactivate && editingBranch?.isActive && active.length <= 1) return;
                        setForm(f => ({ ...f, isActive: !f.isActive }));
                      }}
                      title={form.isActive && active.length <= 1 ? 'Không thể tắt chi nhánh duy nhất' : undefined}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
                        form.isActive && active.length <= 1 ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                      } ${form.isActive ? 'bg-blue-600' : 'bg-gray-200'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {!form.isActive && (
                    <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      Chi nhánh này sẽ bị ẩn sau khi lưu
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} disabled={saving}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors">
                Huỷ
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Thêm mới'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm deactivate dialog */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Tắt chi nhánh?</h3>
                <p className="text-xs text-gray-500 mt-0.5">Thao tác này có thể hoàn tác</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Chi nhánh <span className="font-semibold text-gray-900">&ldquo;{confirmTarget.name}&rdquo;</span> sẽ bị ẩn khỏi toàn bộ hệ thống. Bạn có chắc không?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmTarget(null)}
                className="flex-1 px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium">
                Huỷ
              </button>
              <button onClick={confirmDeactivate}
                className="flex-1 px-4 py-2 text-sm text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors font-medium">
                Tắt chi nhánh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 ${
          toastType === 'error' ? 'bg-red-600' : 'bg-gray-900'
        }`}>
          {toastType === 'error' ? (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {toast}
        </div>
      )}
    </div>
  );
}
