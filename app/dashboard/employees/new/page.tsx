'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { employeesApi } from '@/lib/employees';

const DEPARTMENTS = ['Kinh doanh', 'Kho', 'Kế toán', 'Hành chính', 'IT', 'Marketing', 'Vận chuyển'];

function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function fmtSalary(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return parseInt(digits).toLocaleString('vi-VN');
}
function parseSalary(formatted: string): number {
  return parseInt(formatted.replace(/\./g, '').replace(/\D/g, '')) || 0;
}

export default function NewEmployeePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [salaryDisplay, setSalaryDisplay] = useState('');
  const [form, setForm] = useState({
    code: '', fullName: '', phone: '', email: '', dateOfBirth: '', gender: '',
    address: '', department: '', position: '', hireDate: '', notes: '', isActive: true,
  });

  function set(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: '' }));
  }

  function handlePhoneChange(v: string) {
    const digits = v.replace(/\D/g, '');
    set('phone', digits);
  }

  function handleSalaryChange(v: string) {
    const digits = v.replace(/\D/g, '');
    setSalaryDisplay(digits ? parseInt(digits).toLocaleString('vi-VN') : '');
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = 'Vui lòng nhập họ tên';
    if (form.phone && !/^[0-9]{9,11}$/.test(form.phone)) e.phone = 'SĐT phải là 9–11 chữ số';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email không đúng định dạng';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { fullName: form.fullName, isActive: form.isActive };
      if (form.code)        payload.code        = form.code;
      if (form.phone)       payload.phone       = form.phone;
      if (form.email)       payload.email       = form.email;
      if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;
      if (form.gender)      payload.gender      = form.gender;
      if (form.address)     payload.address     = form.address;
      if (form.department)  payload.department  = form.department;
      if (form.position)    payload.position    = form.position;
      if (form.hireDate)    payload.hireDate    = form.hireDate;
      if (salaryDisplay)    payload.baseSalary  = parseSalary(salaryDisplay);
      if (form.notes)       payload.notes       = form.notes;
      const emp = await employeesApi.create(payload);
      router.push(`/dashboard/employees/${emp.id}`);
    } catch (err: unknown) {
      setErrors({ submit: err instanceof Error ? err.message : 'Lỗi khi tạo nhân viên' });
      setSaving(false);
    }
  }

  const inputCls = (err?: string) =>
    `w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-colors ${
      err ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400' : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-400'
    }`;

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-2.5 flex items-center gap-3 flex-shrink-0">
        <Link href="/dashboard/employees"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-base font-bold text-gray-900">Thêm nhân viên mới</h1>
          <p className="text-gray-400 text-xs mt-0.5">Điền thông tin hồ sơ nhân viên</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-5">
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">{errors.submit}</div>
          )}

          {/* Thông tin cơ bản */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-3">Thông tin cơ bản</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Họ và tên" required error={errors.fullName}>
                <input value={form.fullName} onChange={e => set('fullName', e.target.value)}
                  placeholder="Nguyễn Văn A" className={inputCls(errors.fullName)} />
              </Field>
              <Field label="Mã nhân viên">
                <input value={form.code} onChange={e => set('code', e.target.value)}
                  placeholder="Tự động (NV-001) — nhập để tuỳ chỉnh" className={inputCls()} />
                <p className="text-xs text-gray-400 mt-1">Để trống sẽ tự tạo theo thứ tự</p>
              </Field>
              <Field label="Số điện thoại" error={errors.phone}>
                <input value={form.phone} onChange={e => handlePhoneChange(e.target.value)}
                  placeholder="0901234567" maxLength={11} className={inputCls(errors.phone)} />
              </Field>
              <Field label="Email" error={errors.email}>
                <input value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="email@example.com" className={inputCls(errors.email)} />
              </Field>
              <Field label="Ngày sinh">
                <input type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)}
                  className={inputCls()} />
              </Field>
              <Field label="Giới tính">
                <select value={form.gender} onChange={e => set('gender', e.target.value)}
                  className={inputCls() + ' bg-white'}>
                  <option value="">Chọn giới tính</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                </select>
              </Field>
              <div className="col-span-2">
                <Field label="Địa chỉ">
                  <input value={form.address} onChange={e => set('address', e.target.value)}
                    placeholder="Địa chỉ thường trú" className={inputCls()} />
                </Field>
              </div>
            </div>
          </div>

          {/* Công việc */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-3">Thông tin công việc</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Phòng ban">
                <select value={form.department} onChange={e => set('department', e.target.value)}
                  className={inputCls() + ' bg-white'}>
                  <option value="">Chọn phòng ban</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Chức vụ">
                <input value={form.position} onChange={e => set('position', e.target.value)}
                  placeholder="Nhân viên, Trưởng phòng..." className={inputCls()} />
              </Field>
              <Field label="Ngày vào làm">
                <input type="date" value={form.hireDate} onChange={e => set('hireDate', e.target.value)}
                  className={inputCls()} />
              </Field>
              <Field label="Lương cơ bản (đ)">
                <div className="relative">
                  <input value={salaryDisplay} onChange={e => handleSalaryChange(e.target.value)}
                    placeholder="8.000.000" className={inputCls() + ' pr-6'} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">đ</span>
                </div>
                {salaryDisplay && (
                  <p className="text-xs text-gray-400 mt-1">{parseSalary(salaryDisplay).toLocaleString('vi-VN')} đồng</p>
                )}
              </Field>
              <div className="col-span-2">
                <Field label="Ghi chú">
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                    rows={2} placeholder="Ghi chú thêm..."
                    className={inputCls() + ' resize-none'} />
                </Field>
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)}
                    className="w-4 h-4 rounded text-blue-500 focus:ring-blue-500/30 border-gray-300" />
                  <span className="text-sm text-gray-700">Đang làm việc</span>
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pb-6">
            <Link href="/dashboard/employees"
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors">
              Huỷ
            </Link>
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
              {saving ? 'Đang lưu...' : 'Tạo nhân viên'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
