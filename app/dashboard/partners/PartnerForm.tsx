'use client';

import { useState } from 'react';
import { partnersApi } from '@/lib/partners';

interface Props {
  partner: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50/50 transition";
const selectCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50/50 transition cursor-pointer";

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 text-blue-400">{icon}</div>
        <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{title}</span>
        <div className="flex-1 h-px bg-gray-100 ml-1" />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>
    </div>
  );
}

export default function PartnerForm({ partner, onClose, onSaved }: Props) {
  const isEdit = !!partner;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: (partner?.name as string) || '',
    type: (partner?.type as string) || 'customer',
    customerType: (partner?.customerType as string) || 'individual',
    phone: (partner?.phone as string) || '',
    email: (partner?.email as string) || '',
    address: (partner?.address as string) || '',
    province: (partner?.province as string) || '',
    taxCode: (partner?.taxCode as string) || '',
    contactPerson: (partner?.contactPerson as string) || '',
    birthday: (partner?.birthday as string) || '',
    gender: (partner?.gender as string) || '',
    group: (partner?.group as string) || '',
    rank: (partner?.rank as string) || 'new',
    source: (partner?.source as string) || '',
    creditLimit: (partner?.creditLimit as string) || '0',
    paymentTerm: (partner?.paymentTerm as string) || '',
    bankAccount: (partner?.bankAccount as string) || '',
    bankName: (partner?.bankName as string) || '',
    website: (partner?.website as string) || '',
    zalo: ((partner?.socialLinks as Record<string, string>)?.zalo) || '',
    facebook: ((partner?.socialLinks as Record<string, string>)?.facebook) || '',
    notes: (partner?.notes as string) || '',
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        type: form.type,
        customerType: form.customerType,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        province: form.province || undefined,
        taxCode: form.taxCode || undefined,
        contactPerson: form.contactPerson || undefined,
        birthday: form.birthday || undefined,
        gender: form.gender || undefined,
        group: form.group || undefined,
        rank: form.rank,
        source: form.source || undefined,
        creditLimit: Number(form.creditLimit) || 0,
        paymentTerm: form.paymentTerm ? Number(form.paymentTerm) : undefined,
        bankAccount: form.bankAccount || undefined,
        bankName: form.bankName || undefined,
        website: form.website || undefined,
        notes: form.notes || undefined,
        socialLinks: (form.zalo || form.facebook) ? {
          ...(form.zalo && { zalo: form.zalo }),
          ...(form.facebook && { facebook: form.facebook }),
        } : undefined,
      };
      if (isEdit) {
        await partnersApi.update(partner.id as number, payload);
      } else {
        await partnersApi.create(payload);
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)' }}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isEdit
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />}
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800">{isEdit ? 'Chỉnh sửa đối tác' : 'Thêm đối tác mới'}</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">{isEdit ? 'Cập nhật thông tin' : 'Điền thông tin để tạo mới'}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

            {/* Thông tin cơ bản */}
            <Section title="Thông tin cơ bản" icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            }>
              <div className="col-span-2">
                <Field label="Tên đối tác" required>
                  <input required value={form.name} onChange={(e) => set('name', e.target.value)}
                    className={inputCls} placeholder="Nhập tên khách hàng hoặc công ty" />
                </Field>
              </div>
              <Field label="Loại đối tác">
                <select value={form.type} onChange={(e) => set('type', e.target.value)} className={selectCls}>
                  <option value="customer">Khách hàng</option>
                  <option value="supplier">Nhà cung cấp</option>
                  <option value="both">Khách hàng + NCC</option>
                </select>
              </Field>
              <Field label="Hình thức">
                <select value={form.customerType} onChange={(e) => set('customerType', e.target.value)} className={selectCls}>
                  <option value="individual">Cá nhân</option>
                  <option value="business">Doanh nghiệp</option>
                </select>
              </Field>
              <Field label="Hạng">
                <select value={form.rank} onChange={(e) => set('rank', e.target.value)} className={selectCls}>
                  <option value="new">Mới</option>
                  <option value="normal">Thường</option>
                  <option value="loyal">Thân thiết</option>
                  <option value="vip">VIP</option>
                </select>
              </Field>
              <Field label="Nguồn khách">
                <input value={form.source} onChange={(e) => set('source', e.target.value)}
                  className={inputCls} placeholder="Zalo, giới thiệu, Facebook..." />
              </Field>
            </Section>

            {/* Liên hệ */}
            <Section title="Liên hệ" icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            }>
              <Field label="Điện thoại">
                <input value={form.phone} onChange={(e) => set('phone', e.target.value)}
                  className={inputCls} placeholder="0901 234 567" />
              </Field>
              <Field label="Email">
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                  className={inputCls} placeholder="email@example.com" />
              </Field>
              <Field label="Người liên hệ">
                <input value={form.contactPerson} onChange={(e) => set('contactPerson', e.target.value)}
                  className={inputCls} placeholder="Tên người đại diện" />
              </Field>
              <Field label="Tỉnh / Thành phố">
                <input value={form.province} onChange={(e) => set('province', e.target.value)}
                  className={inputCls} placeholder="Hà Nội, TP.HCM..." />
              </Field>
              <div className="col-span-2">
                <Field label="Địa chỉ">
                  <input value={form.address} onChange={(e) => set('address', e.target.value)}
                    className={inputCls} placeholder="Số nhà, đường, phường/xã..." />
                </Field>
              </div>
              {form.customerType === 'individual' && (
                <>
                  <Field label="Ngày sinh">
                    <input type="date" value={form.birthday} onChange={(e) => set('birthday', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Giới tính">
                    <select value={form.gender} onChange={(e) => set('gender', e.target.value)} className={selectCls}>
                      <option value="">— Chọn —</option>
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                      <option value="other">Khác</option>
                    </select>
                  </Field>
                </>
              )}
              {form.customerType === 'business' && (
                <Field label="Mã số thuế">
                  <input value={form.taxCode} onChange={(e) => set('taxCode', e.target.value)}
                    className={inputCls} placeholder="0123456789" />
                </Field>
              )}
            </Section>

            {/* Tài chính */}
            <Section title="Tài chính" icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            }>
              <Field label="Hạn mức công nợ (đ)">
                <input type="number" value={form.creditLimit} onChange={(e) => set('creditLimit', e.target.value)}
                  className={inputCls} placeholder="0" />
              </Field>
              <Field label="Thời hạn thanh toán (ngày)">
                <input type="number" value={form.paymentTerm} onChange={(e) => set('paymentTerm', e.target.value)}
                  className={inputCls} placeholder="30" />
              </Field>
              <Field label="Số tài khoản ngân hàng">
                <input value={form.bankAccount} onChange={(e) => set('bankAccount', e.target.value)}
                  className={inputCls} placeholder="0123456789" />
              </Field>
              <Field label="Ngân hàng">
                <input value={form.bankName} onChange={(e) => set('bankName', e.target.value)}
                  className={inputCls} placeholder="Vietcombank, BIDV..." />
              </Field>
            </Section>

            {/* Mạng xã hội */}
            <Section title="Mạng xã hội & Website" icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
            }>
              <Field label="Website">
                <input value={form.website} onChange={(e) => set('website', e.target.value)}
                  className={inputCls} placeholder="https://example.com" />
              </Field>
              <Field label="Zalo">
                <input value={form.zalo} onChange={(e) => set('zalo', e.target.value)}
                  className={inputCls} placeholder="Số điện thoại Zalo" />
              </Field>
              <div className="col-span-2">
                <Field label="Facebook">
                  <input value={form.facebook} onChange={(e) => set('facebook', e.target.value)}
                    className={inputCls} placeholder="https://facebook.com/..." />
                </Field>
              </div>
            </Section>

            {/* Ghi chú */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Ghi chú</label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
                className={`${inputCls} resize-none`} placeholder="Thông tin thêm về đối tác..." />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex-shrink-0 rounded-b-2xl">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-500 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-100 transition">
              Hủy
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition shadow-sm shadow-blue-200 flex items-center justify-center gap-2">
              {loading && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
              {loading ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm đối tác'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
