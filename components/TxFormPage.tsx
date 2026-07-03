'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { transactionsApi, branchesApi, partnersApi, transactionGroupsApi } from '@/lib/transactions';
import { settingsApi } from '@/lib/settings';
import { bankAccountsApi } from '@/lib/bank-accounts';
import { getToken } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const PAYER_GROUPS = [
  { value: '', label: '— Chọn nhóm —' },
  { value: 'customer', label: 'Khách hàng' },
  { value: 'supplier', label: 'Nhà cung cấp' },
  { value: 'employee', label: 'Nhân viên' },
  { value: 'other', label: 'Đối tượng khác' },
];

// Fallback khi API chưa load xong
const PTTT_FALLBACK = [
  { code: 'TM', name: 'Tiền mặt' },
  { code: 'CK', name: 'Chuyển khoản' },
  { code: 'MM', name: 'MoMo' },
  { code: 'KH', name: 'Khác' },
];

// Map giá trị enum cũ (trước khi có bảng payment_methods) → code mới
const LEGACY_PM_MAP: Record<string, string> = {
  cash: 'TM',
  bank_transfer: 'CK',
  momo: 'MM',
  other: 'KH',
};

interface Props {
  type: 'receipt' | 'payment';
  txId?: number;
}

export default function TxFormPage({ type, txId }: Props) {
  const router = useRouter();
  const isReceipt = type === 'receipt';
  const backHref = isReceipt ? '/dashboard/thu-chi/phieu-thu' : '/dashboard/thu-chi/phieu-chi';
  const pageTitle = txId
    ? `Chỉnh sửa ${isReceipt ? 'phiếu thu' : 'phiếu chi'}`
    : `Thêm mới ${isReceipt ? 'phiếu thu' : 'phiếu chi'}`;

  const [loading, setLoading] = useState(!!txId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [txCode, setTxCode] = useState('');

  const todayLocal = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const [form, setForm] = useState({
    payerType: '',
    partnerId: '',
    groupId: '',
    category: '',
    amount: '',
    paymentMethod: 'TM',
    bankAccountId: '',
    date: todayLocal,
    reference: '',
    affectsBusinessResult: true,
    hopLeTax: false,
    isFixed: false,
    updatePartnerDebt: false,
    branchId: '',
    note: '',
    tags: '',
  });

  const [ptttOptions, setPtttOptions] = useState<{ code: string; name: string }[]>(PTTT_FALLBACK);
  const [bankAccounts, setBankAccounts] = useState<{ id: number; code: string; bankName: string; accountNumber: string; accountHolder: string }[]>([]);
  const [partners, setPartners] = useState<{ id: number; name: string; code?: string; type?: string }[]>([]);
  const [groups, setGroups] = useState<{ id: number; name: string; affectsBusinessResult: boolean; isActive?: boolean }[]>([]);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [showPartnerDrop, setShowPartnerDrop] = useState(false);
  const [showCatDrop, setShowCatDrop] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [amountFocused, setAmountFocused] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  // Search đối tác — debounce 300ms, gọi API thay vì load tất cả
  const partnerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (partnerSearchTimer.current) clearTimeout(partnerSearchTimer.current);
    partnerSearchTimer.current = setTimeout(() => {
      const params: Record<string, string> = { limit: '20' };
      if (form.payerType === 'customer') params.type = 'customer';
      if (form.payerType === 'supplier') params.type = 'supplier';
      if (partnerSearch) params.search = partnerSearch;
      partnersApi.getAll(params).then((r: any) => setPartners(r.data || r || [])).catch(() => {});
    }, 300);
    return () => { if (partnerSearchTimer.current) clearTimeout(partnerSearchTimer.current); };
  }, [partnerSearch, form.payerType]);

  useEffect(() => {
    transactionGroupsApi.getAll(type).then((r: any) => setGroups(r || [])).catch(() => {});
    branchesApi.getAll().then((r: any) => setBranches(r.data || r || [])).catch(() => {});
    transactionsApi.getCategories().then((r: any) => setCategories(r[type === 'receipt' ? 'receipt' : 'payment'] || [])).catch(() => {});
    settingsApi.getPaymentMethods(true).then((r: any) => { if (r?.length) setPtttOptions(r); }).catch(() => {});
    bankAccountsApi.getAll(true).then((r: any) => setBankAccounts(r || [])).catch(() => {});

    if (txId) {
      transactionsApi.getOne(txId).then((tx: any) => {
        const rawPm: string = tx.paymentMethod || 'TM';
        const pm = LEGACY_PM_MAP[rawPm] ?? rawPm;
        setTxCode(tx.code || '');
        setForm({
          payerType: tx.payerType || '',
          partnerId: tx.partner?.id ? String(tx.partner.id) : '',
          groupId: tx.groupId ? String(tx.groupId) : '',
          category: tx.category || '',
          amount: String(tx.amount || ''),
          paymentMethod: pm,
          bankAccountId: tx.bankAccountId ? String(tx.bankAccountId) : '',
          date: tx.date ? tx.date.slice(0, 10) : todayLocal,
          reference: tx.reference || '',
          affectsBusinessResult: tx.affectsBusinessResult !== false,
          hopLeTax: (tx as any).hopLeTax ?? false,
          isFixed: (tx as any).isFixed ?? false,
          updatePartnerDebt: tx.partnerDebtAdjusted ?? false,
          branchId: tx.branchId ? String(tx.branchId) : '',
          note: tx.note || '',
          tags: tx.tags || '',
        });
        setPartnerSearch(tx.partner?.name || '');
        setImageUrl(tx.imageUrl || '');
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [txId, type]);

  // Lọc đối tác theo nhóm được chọn
  // partners đã được filter từ API (search + type), dùng trực tiếp

  function selectPartner(p: { id: number; name: string }) {
    set('partnerId', String(p.id));
    setPartnerSearch(p.name);
    setShowPartnerDrop(false);
  }

  function handleGroupChange(groupIdStr: string) {
    set('groupId', groupIdStr);
    if (groupIdStr) {
      const g = groups.find(g => String(g.id) === groupIdStr);
      if (g) set('affectsBusinessResult', g.affectsBusinessResult);
    }
  }

  const selectedGroup = form.groupId ? groups.find(g => String(g.id) === form.groupId) : null;
  const filteredCats = categories.filter(c => !form.category || c.toLowerCase().includes(form.category.toLowerCase())).slice(0, 8);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || isNaN(Number(form.amount))) { setError('Số tiền không hợp lệ'); return; }
    if (!form.branchId) { setError('Vui lòng chọn chi nhánh'); return; }
    setSaving(true); setError('');
    try {
      const payload: Record<string, any> = {
        type,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        bankAccountId: form.bankAccountId ? Number(form.bankAccountId) : undefined,
        date: form.date,
        affectsBusinessResult: form.affectsBusinessResult,
        hopLeTax: !isReceipt ? form.hopLeTax : undefined,
        isFixed: !isReceipt ? form.isFixed : undefined,
        updatePartnerDebt: form.partnerId ? form.updatePartnerDebt : undefined,
        groupId: form.groupId ? Number(form.groupId) : undefined,
        category: form.category || undefined,
        note: form.note || undefined,
        reference: form.reference || undefined,
        tags: form.tags || undefined,
        imageUrl: imageUrl || undefined,
        payerType: form.payerType || undefined,
        partnerId: form.partnerId ? Number(form.partnerId) : undefined,
        branchId: form.branchId ? Number(form.branchId) : undefined,
      };
      if (txId) await transactionsApi.update(txId, payload);
      else await transactionsApi.create(payload);
      router.push(backHref);
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra');
      setSaving(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Ảnh tối đa 5MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE}/uploads/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      if (!res.ok) throw new Error('Upload thất bại');
      const data = await res.json();
      setImageUrl(data.url);
    } catch {
      setError('Upload ảnh thất bại');
    } finally {
      setUploading(false);
    }
  }

  const accentBtn = isReceipt
    ? 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-400'
    : 'bg-red-600 hover:bg-red-700 focus:ring-red-400';
  const accentNote = isReceipt ? 'text-emerald-600' : 'text-red-600';
  const inputCls = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white';
  const labelCls = 'block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide';
  const cardCls = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-6';

  if (loading) return (
    <div className="flex items-center justify-center h-full text-gray-400 text-sm">Đang tải...</div>
  );

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <Link href={backHref}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition group">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {pageTitle}
          </Link>
          {txCode && (
            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">{txCode}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href={backHref}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            Thoát
          </Link>
          <button type="submit" form="tx-form" disabled={saving}
            className={`px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-60 transition ${accentBtn}`}>
            {saving ? 'Đang lưu...' : txId ? 'Cập nhật' : 'Lưu phiếu'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        <form id="tx-form" onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{error}</div>
          )}

          <div className="flex gap-5 items-start">
            {/* ── Left column ── */}
            <div className="flex-1 min-w-0 space-y-4">

              {/* Thông tin chung */}
              <div className={cardCls}>
                <p className="text-sm font-bold text-gray-700 mb-4">Thông tin chung</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Nhóm người {isReceipt ? 'nộp' : 'nhận'} <span className="text-red-500">*</span></label>
                    <select value={form.payerType} onChange={e => { set('payerType', e.target.value); set('partnerId', ''); setPartnerSearch(''); }} className={inputCls}>
                      {PAYER_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Đối tác / Tên người {isReceipt ? 'nộp' : 'nhận'} <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input value={partnerSearch}
                        onChange={e => { setPartnerSearch(e.target.value); set('partnerId', ''); setShowPartnerDrop(true); }}
                        onFocus={() => setShowPartnerDrop(true)}
                        onBlur={() => setTimeout(() => setShowPartnerDrop(false), 150)}
                        placeholder="Tìm đối tác..." className={inputCls} />
                      {showPartnerDrop && partners.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                          {partners.map(p => (
                            <button key={p.id} type="button" onMouseDown={() => selectPartner(p)}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 flex items-center justify-between">
                              <span>{p.name}</span>
                              {p.code && <span className="text-xs text-gray-400 font-mono">{p.code}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Loại phiếu {isReceipt ? 'thu' : 'chi'} <span className="text-red-500">*</span></label>
                    <select value={form.groupId} onChange={e => handleGroupChange(e.target.value)} className={inputCls}>
                      <option value="">— Chọn loại phiếu —</option>
                      {groups.filter(g => g.isActive !== false).map(g => (
                        <option key={g.id} value={String(g.id)}>{g.name}</option>
                      ))}
                    </select>
                    {groups.length === 0 && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        Chưa có loại phiếu. <Link href={isReceipt ? '/dashboard/thu-chi/loai-phieu-thu' : '/dashboard/thu-chi/loai-phieu-chi'} className={`${accentNote} hover:underline`}>Tạo ngay</Link>
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Số tham chiếu</label>
                    <input value={form.reference} onChange={e => set('reference', e.target.value)}
                      placeholder="Mã đơn hàng, hóa đơn..." className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Giá trị ghi nhận */}
              <div className={cardCls}>
                <p className="text-sm font-bold text-gray-700 mb-4">Giá trị ghi nhận</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Số tiền (VNĐ) <span className="text-red-500">*</span></label>
                    <input type="text" inputMode="numeric"
                      value={amountFocused
                        ? form.amount
                        : (form.amount ? Number(form.amount).toLocaleString('vi-VN') : '')}
                      onFocus={() => setAmountFocused(true)}
                      onBlur={() => setAmountFocused(false)}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        set('amount', raw);
                      }}
                      required placeholder="0" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Hình thức thanh toán <span className="text-red-500">*</span></label>
                    <select value={form.paymentMethod} onChange={e => { set('paymentMethod', e.target.value); set('bankAccountId', ''); }} className={inputCls}>
                      {ptttOptions.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}
                    </select>
                  </div>
                  {form.paymentMethod === 'CK' && (
                    <div>
                      <label className={labelCls}>Tài khoản ngân hàng</label>
                      <select value={form.bankAccountId} onChange={e => set('bankAccountId', e.target.value)} className={inputCls}>
                        <option value="">— Chọn tài khoản —</option>
                        {bankAccounts.map(b => (
                          <option key={b.id} value={String(b.id)}>
                            {b.bankName} — {b.accountNumber} ({b.accountHolder})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={form.affectsBusinessResult}
                      onChange={e => set('affectsBusinessResult', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Hạch toán kết quả kinh doanh</span>
                  </label>
                  {!isReceipt && (
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={form.hopLeTax as boolean}
                        onChange={e => set('hopLeTax', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300" />
                      <span className="text-sm text-gray-700">
                        Chi phí hợp lệ tính thuế TNDN
                        <span className="ml-1.5 text-xs text-gray-400">(xuất hiện trong báo cáo thuế)</span>
                      </span>
                    </label>
                  )}
                  {!isReceipt && (
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={form.isFixed as boolean}
                        onChange={e => set('isFixed', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300" />
                      <span className="text-sm text-gray-700">
                        Chi phí cố định (dùng tính điểm hoà vốn)
                        <span className="ml-1.5 text-xs text-gray-400">(lương, thuê mặt bằng, KH tài sản...)</span>
                      </span>
                    </label>
                  )}
                  {selectedGroup && (
                    <p className="text-xs text-gray-400 pl-6">
                      Lưu ý: Mặc định theo loại phiếu là <span className={`font-semibold ${selectedGroup.affectsBusinessResult ? accentNote : 'text-gray-500'}`}>{selectedGroup.affectsBusinessResult ? 'Có' : 'Không'}</span>. Bạn có thể thay đổi cho phiếu này.
                    </p>
                  )}
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={form.updatePartnerDebt as boolean}
                      onChange={e => set('updatePartnerDebt', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Cập nhật công nợ đối tác</span>
                  </label>
                  {form.updatePartnerDebt && (
                    <p className="text-xs text-gray-400 pl-6">
                      {form.partnerId
                        ? (isReceipt ? 'Công nợ của đối tác sẽ được giảm theo số tiền thu.' : 'Công nợ của đối tác sẽ được giảm theo số tiền chi.')
                        : 'Vui lòng chọn đối tác để cập nhật công nợ.'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Right column ── */}
            <div className="w-72 shrink-0 space-y-4">
              <div className={cardCls}>
                <p className="text-sm font-bold text-gray-700 mb-4">Thông tin bổ sung</p>
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Chi nhánh <span className="text-red-500">*</span></label>
                    <select value={form.branchId} onChange={e => set('branchId', e.target.value)}
                      className={`${inputCls} ${!form.branchId ? 'border-orange-200' : ''}`}>
                      <option value="">— Chọn chi nhánh —</option>
                      {branches.map(b => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
                    </select>
                    {!form.branchId && (
                      <p className="text-[11px] text-orange-500 mt-1">Bắt buộc chọn chi nhánh</p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Ngày {isReceipt ? 'thu' : 'chi'} *</label>
                    <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                      required className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Diễn giải ngắn</label>
                    <div className="relative">
                      <input value={form.category}
                        onChange={e => { set('category', e.target.value); setShowCatDrop(true); }}
                        onFocus={() => setShowCatDrop(true)}
                        onBlur={() => setTimeout(() => setShowCatDrop(false), 150)}
                        placeholder="Gõ hoặc chọn gợi ý..." className={inputCls} />
                      {showCatDrop && filteredCats.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-44 overflow-y-auto">
                          {filteredCats.map(c => (
                            <button key={c} type="button" onMouseDown={() => { set('category', c); setShowCatDrop(false); }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                              {c}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Diễn giải / Mô tả</label>
                    <textarea value={form.note} onChange={e => set('note', e.target.value)} rows={4}
                      placeholder={`Mô tả nội dung ${isReceipt ? 'phiếu thu' : 'phiếu chi'}...`}
                      className={`${inputCls} resize-none`} />
                  </div>
                  <div>
                    <label className={labelCls}>Tags / Nhãn</label>
                    <input value={form.tags} onChange={e => set('tags', e.target.value)}
                      placeholder="Nhãn 1, Nhãn 2..." className={inputCls} />
                    <p className="text-[11px] text-gray-400 mt-1">Phân cách bằng dấu phẩy</p>
                  </div>
                  <div>
                    <label className={labelCls}>Ảnh chứng từ</label>
                    <div className="flex items-start gap-3">
                      <label className={`flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-gray-500">{uploading ? 'Đang tải...' : 'Chọn ảnh'}</span>
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                      </label>
                      {imageUrl && (
                        <div className="relative">
                          <img src={imageUrl} alt="Chứng từ" className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
                          <button type="button" onClick={() => setImageUrl('')}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs leading-none">×</button>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">JPG, PNG, WebP — tối đa 5MB</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
