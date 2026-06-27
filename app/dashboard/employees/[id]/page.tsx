'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { employeesApi } from '@/lib/employees';

interface Employee {
  id: number; code: string; fullName: string; phone?: string; email?: string;
  dateOfBirth?: string; gender?: string; address?: string; avatarUrl?: string;
  department?: string; position?: string; hireDate?: string;
  baseSalary: number; isActive: boolean; notes?: string; userId?: number;
  user?: { id: number; username: string; role: string; isActive: boolean } | null;
  createdAt: string; updatedAt: string;
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Quản trị', manager: 'Quản lý', sales: 'Kinh doanh',
  warehouse: 'Thủ kho', accountant: 'Kế toán', viewer: 'Xem', staff: 'Nhân viên',
};
const ROLES = ['admin','manager','sales','warehouse','accountant','viewer'];
const DEPARTMENTS = ['Kinh doanh', 'Kho', 'Kế toán', 'Hành chính', 'IT', 'Marketing', 'Vận chuyển'];

function fmt(n: number) { return n.toLocaleString('vi-VN'); }
function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('vi-VN');
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [emp, setEmp]     = useState<Employee | null>(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<'info' | 'account'>('info');
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  // Edit form
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  // Account form
  const [accForm, setAccForm] = useState({ username: '', password: '', role: 'sales' });
  const [accSaving, setAccSaving] = useState(false);
  const [accError, setAccError]   = useState('');
  // Change role/password
  const [changeRole, setChangeRole] = useState('');
  const [newPwd, setNewPwd]         = useState('');
  const [changeSaving, setChangeSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await employeesApi.getOne(Number(id));
      setEmp(data);
      setForm({
        code: data.code || '', fullName: data.fullName || '', phone: data.phone || '', email: data.email || '',
        dateOfBirth: data.dateOfBirth || '', gender: data.gender || '',
        address: data.address || '', department: data.department || '',
        position: data.position || '', hireDate: data.hireDate || '',
        baseSalary: data.baseSalary ? String(data.baseSalary) : '',
        notes: data.notes || '', isActive: data.isActive,
      });
      if (data.user) setChangeRole(data.user.role);
    } catch { router.push('/dashboard/employees'); }
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  function setF(k: string, v: string | boolean) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.fullName) { setError('Vui lòng nhập họ tên'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload: Record<string, unknown> = { fullName: form.fullName, isActive: form.isActive };
      if (form.code) payload.code = form.code;
      const fields = ['phone','email','dateOfBirth','gender','address','department','position','hireDate','notes'];
      fields.forEach(f => { if (form[f]) payload[f] = form[f]; });
      if (form.baseSalary) payload.baseSalary = parseInt(String(form.baseSalary).replace(/\./g, '')) || 0;
      await employeesApi.update(Number(id), payload);
      setSuccess('Đã lưu thông tin');
      setEditing(false);
      await load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Lỗi'); }
    setSaving(false);
  }

  async function handleCreateAccount() {
    if (!accForm.username || !accForm.password) { setAccError('Nhập đủ tên đăng nhập và mật khẩu'); return; }
    setAccSaving(true); setAccError('');
    try {
      await employeesApi.createAccount(Number(id), accForm);
      setAccForm({ username: '', password: '', role: 'sales' });
      await load();
    } catch (err: unknown) { setAccError(err instanceof Error ? err.message : 'Lỗi'); }
    setAccSaving(false);
  }

  async function handleUpdateAccount() {
    setChangeSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (changeRole !== emp?.user?.role) payload.role = changeRole;
      if (newPwd) payload.password = newPwd;
      if (Object.keys(payload).length) await employeesApi.updateAccount(Number(id), payload);
      setNewPwd('');
      setSuccess('Đã cập nhật tài khoản');
      await load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Lỗi'); }
    setChangeSaving(false);
  }

  async function handleToggleAccount() {
    try { await employeesApi.toggleAccount(Number(id)); await load(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Lỗi'); }
  }

  async function handleRemoveAccount() {
    if (!confirm('Thu hồi tài khoản này? Nhân viên sẽ không thể đăng nhập.')) return;
    try { await employeesApi.removeAccount(Number(id)); await load(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Lỗi'); }
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await employeesApi.remove(Number(id));
      router.push('/dashboard/employees');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Lỗi khi xóa'); setDeleting(false); setShowDeleteConfirm(false); }
  }

  if (loading) return <div className="p-6 text-gray-400">Đang tải...</div>;
  if (!emp)    return null;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/employees"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white font-bold text-lg">
              {emp.fullName.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{emp.fullName}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-gray-400">{emp.code}</span>
                {emp.department && <span className="text-sm text-gray-400">• {emp.department}</span>}
                {emp.position && <span className="text-sm text-gray-400">• {emp.position}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
            emp.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-50 text-gray-400 border border-gray-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${emp.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            {emp.isActive ? 'Đang làm' : 'Đã nghỉ'}
          </span>
          {emp.user && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
              🔑 {emp.user.username}
            </span>
          )}
          <button onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Xóa nhân viên">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([['info','Thông tin HR'],['account','Tài khoản & Phân quyền']] as const).map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>{l}</button>
        ))}
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}
      {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm px-4 py-3 rounded-xl">{success}</div>}

      {/* Tab: Thông tin HR */}
      {tab === 'info' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Hồ sơ nhân viên</h2>
            {!editing
              ? <button onClick={() => { setEditing(true); setError(''); setSuccess(''); }}
                  className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium">Chỉnh sửa</button>
              : <div className="flex gap-2">
                  <button onClick={() => { setEditing(false); setError(''); }}
                    className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 rounded-lg transition-colors">Huỷ</button>
                  <button onClick={handleSave} disabled={saving}
                    className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 font-medium transition-colors">
                    {saving ? 'Đang lưu...' : 'Lưu'}
                  </button>
                </div>
            }
          </div>

          {editing ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Họ và tên *</label>
                <input value={String(form.fullName)} onChange={e => setF('fullName', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Mã nhân viên</label>
                <input value={String(form.code)} onChange={e => setF('code', e.target.value)}
                  placeholder="NV-001"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">SĐT</label>
                <input value={String(form.phone)} onChange={e => setF('phone', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
                <input value={String(form.email)} onChange={e => setF('email', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Phòng ban</label>
                <select value={String(form.department)} onChange={e => setF('department', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white">
                  <option value="">Chọn phòng ban</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Chức vụ</label>
                <input value={String(form.position)} onChange={e => setF('position', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Ngày vào làm</label>
                <input type="date" value={String(form.hireDate)} onChange={e => setF('hireDate', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Lương cơ bản (đ)</label>
                <input value={String(form.baseSalary)} onChange={e => setF('baseSalary', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Ngày sinh</label>
                <input type="date" value={String(form.dateOfBirth)} onChange={e => setF('dateOfBirth', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Giới tính</label>
                <select value={String(form.gender)} onChange={e => setF('gender', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white">
                  <option value="">Chọn</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Địa chỉ</label>
                <input value={String(form.address)} onChange={e => setF('address', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Ghi chú</label>
                <textarea value={String(form.notes)} onChange={e => setF('notes', e.target.value)} rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none" />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={Boolean(form.isActive)} onChange={e => setF('isActive', e.target.checked)}
                    className="w-4 h-4 rounded text-blue-500 focus:ring-blue-500/30" />
                  <span className="text-sm text-gray-700">Đang làm việc</span>
                </label>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              {[
                ['Mã nhân viên', emp.code],
                ['Số điện thoại', emp.phone],
                ['Email', emp.email],
                ['Ngày sinh', fmtDate(emp.dateOfBirth)],
                ['Giới tính', emp.gender === 'male' ? 'Nam' : emp.gender === 'female' ? 'Nữ' : undefined],
                ['Phòng ban', emp.department],
                ['Chức vụ', emp.position],
                ['Ngày vào làm', fmtDate(emp.hireDate)],
                ['Lương cơ bản', emp.baseSalary > 0 ? fmt(emp.baseSalary) + 'đ' : undefined],
                ['Địa chỉ', emp.address],
                ['Ghi chú', emp.notes],
                ['Ngày tạo', fmtDate(emp.createdAt)],
              ].map(([label, val]) => (
                <div key={String(label)}>
                  <div className="text-xs text-gray-400 font-medium">{label}</div>
                  <div className="text-sm text-gray-800 mt-0.5">{val || '—'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Tài khoản */}
      {tab === 'account' && (
        <div className="space-y-4">
          {!emp.user ? (
            /* Chưa có tài khoản — form tạo */
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <h2 className="font-semibold text-gray-800">Cấp tài khoản đăng nhập</h2>
              <p className="text-sm text-gray-400">Nhân viên chưa có tài khoản. Tạo tài khoản để họ có thể đăng nhập hệ thống.</p>
              {accError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">{accError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Tên đăng nhập *</label>
                  <input value={accForm.username} onChange={e => setAccForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="nguyenvana" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Mật khẩu *</label>
                  <input type="password" value={accForm.password} onChange={e => setAccForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Vai trò</label>
                  <select value={accForm.role} onChange={e => setAccForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white">
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={handleCreateAccount} disabled={accSaving}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
                {accSaving ? 'Đang tạo...' : 'Cấp tài khoản'}
              </button>
            </div>
          ) : (
            /* Đã có tài khoản */
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">Thông tin tài khoản</h2>
                <button onClick={handleToggleAccount}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    emp.user.isActive
                      ? 'text-red-600 hover:bg-red-50 border border-red-200'
                      : 'text-emerald-600 hover:bg-emerald-50 border border-emerald-200'
                  }`}>
                  {emp.user.isActive ? 'Khoá tài khoản' : 'Mở khoá'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-400 font-medium">Tên đăng nhập</div>
                  <div className="text-sm font-semibold text-gray-800 mt-0.5">{emp.user.username}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 font-medium">Trạng thái</div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-0.5 ${
                    emp.user.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${emp.user.isActive ? 'bg-emerald-500' : 'bg-red-400'}`} />
                    {emp.user.isActive ? 'Hoạt động' : 'Đã khoá'}
                  </span>
                </div>
              </div>

              {/* Đổi vai trò */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <h3 className="text-sm font-medium text-gray-700">Cập nhật vai trò / mật khẩu</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Vai trò</label>
                    <select value={changeRole} onChange={e => setChangeRole(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white">
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Đặt lại mật khẩu</label>
                    <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                      placeholder="Để trống nếu không đổi"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                  </div>
                </div>
                <button onClick={handleUpdateAccount} disabled={changeSaving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 font-medium transition-colors">
                  {changeSaving ? 'Đang lưu...' : 'Cập nhật'}
                </button>
              </div>

              {/* Thu hồi */}
              <div className="border-t border-gray-100 pt-4">
                <button onClick={handleRemoveAccount}
                  className="text-sm text-red-500 hover:text-red-700 hover:underline transition-colors">
                  Thu hồi tài khoản (xoá vĩnh viễn)
                </button>
              </div>
            </div>
          )}

          {/* Ma trận phân quyền */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Ma trận phân quyền theo vai trò</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-4 font-medium text-gray-500 w-40">Module</th>
                    {ROLES.map(r => (
                      <th key={r} className={`py-2 px-2 text-center font-medium ${(emp.user?.role || accForm.role) === r ? 'text-blue-600 bg-blue-50 rounded-t' : 'text-gray-400'}`}>
                        {ROLE_LABEL[r]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    ['Đơn Hàng — xem',    [1,1,1,0,1,1,1]],
                    ['Đơn Hàng — tạo/sửa',[1,1,1,0,0,0,0]],
                    ['Đối Tác — xem',      [1,1,1,0,1,1,1]],
                    ['Đối Tác — tạo/sửa', [1,1,1,0,0,0,0]],
                    ['Sản Phẩm — xem',     [1,1,1,1,0,1,1]],
                    ['Sản Phẩm — sửa',     [1,1,0,1,0,0,1]],
                    ['Thu Chi — xem',      [1,1,0,0,1,0,0]],
                    ['Thu Chi — tạo',      [1,1,0,0,1,0,0]],
                    ['Nhân Viên',          [1,1,0,0,0,0,0]],
                    ['Cài Đặt',            [1,0,0,0,0,0,0]],
                    ['Báo Cáo',            [1,1,0,0,1,0,0]],
                  ].map(([label, perms]) => (
                    <tr key={String(label)}>
                      <td className="py-1.5 pr-4 text-gray-600">{String(label)}</td>
                      {(perms as number[]).map((p, i) => (
                        <td key={i} className={`py-1.5 px-2 text-center ${(emp.user?.role || accForm.role) === ROLES[i] ? 'bg-blue-50' : ''}`}>
                          <span className={p ? 'text-emerald-500' : 'text-gray-200'}>{p ? '✓' : '✗'}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận xóa */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Xóa nhân viên</h3>
                <p className="text-sm text-gray-400 mt-0.5">Hành động này không thể hoàn tác</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Bạn có chắc muốn xóa <span className="font-semibold text-gray-900">{emp.fullName}</span> ({emp.code})? Nhân viên sẽ bị đánh dấu nghỉ việc và ẩn khỏi hệ thống.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors">
                Huỷ
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl disabled:opacity-60 transition-colors">
                {deleting ? 'Đang xóa...' : 'Xóa nhân viên'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
