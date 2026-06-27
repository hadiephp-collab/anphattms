'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { partnersApi } from '@/lib/partners';
import { transactionsApi, PM_LABEL } from '@/lib/transactions';
import { ordersApi } from '@/lib/orders';
import { getMe } from '@/lib/auth';

const RANK_LABEL: Record<string, string> = { new: 'Mới', normal: 'Thường', loyal: 'Thân thiết', vip: 'VIP' };
const RANK_STYLE: Record<string, { badge: string; bg: string; text: string }> = {
  new:    { badge: 'bg-gray-100 text-gray-500 border border-gray-200',        bg: 'bg-gray-50',    text: 'text-gray-500' },
  normal: { badge: 'bg-sky-50 text-sky-600 border border-sky-100',            bg: 'bg-sky-50',     text: 'text-sky-600' },
  loyal:  { badge: 'bg-emerald-50 text-emerald-600 border border-emerald-100',bg: 'bg-emerald-50', text: 'text-emerald-600' },
  vip:    { badge: 'bg-amber-50 text-amber-500 border border-amber-200',      bg: 'bg-amber-50',   text: 'text-amber-500' },
};
const TYPE_LABEL: Record<string, string> = { customer: 'Khách hàng', supplier: 'Nhà cung cấp', both: 'KH + NCC' };
const TYPE_STYLE: Record<string, string> = {
  customer: 'bg-blue-50 text-blue-600',
  supplier: 'bg-violet-50 text-violet-600',
  both:     'bg-teal-50 text-teal-600',
};
const GENDER_LABEL: Record<string, string> = { male: 'Nam', female: 'Nữ', other: 'Khác' };

interface PartnerDetail {
  id: number; code: string; name: string; type: string; customerType: string;
  phone?: string; email?: string; address?: string; province?: string;
  taxCode?: string; contactPerson?: string; birthday?: string; gender?: string;
  group?: string; rank: string; source?: string;
  creditLimit: number; totalDebt: number; supplierDebt?: number; totalOrders: number; totalRevenue: number;
  paymentTerm?: number; bankAccount?: string; bankName?: string;
  website?: string; socialLinks?: Record<string, string>;
  notes?: string; isActive: boolean;
  assignedStaff?: { id: number; name: string; email?: string };
  createdAt: string; updatedAt: string;
}

interface TxItem {
  id: number; code: string; type: string; amount: number;
  paymentMethod: string; note?: string; date: string; category?: string;
  createdBy?: { name: string }; createdAt: string;
}

const TABS = [
  { key: 'history',  label: 'Lịch sử đơn hàng' },
  { key: 'debt',     label: 'Công nợ & Phiếu' },
  { key: 'contact',  label: 'Liên hệ' },
  { key: 'address',  label: 'Địa chỉ' },
  { key: 'notes',    label: 'Ghi chú' },
  { key: 'bank',     label: 'Ngân hàng' },
] as const;
type TabKey = typeof TABS[number]['key'];

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-gray-400 font-medium mb-0.5 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-gray-700 font-medium">
        {value ?? <span className="text-gray-300 font-normal">—</span>}
      </dd>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3.5">
      <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-800 leading-none">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function fmt(n?: number | string) {
  const num = Number(n ?? 0);
  return num > 0 ? `${num.toLocaleString('vi-VN')}đ` : '0đ';
}

const nowDatetime = () => {
  const d = new Date();
  // format YYYY-MM-DDTHH:mm for datetime-local input
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/* ────────────────────────────────────────────────
   Modal tạo phiếu thu / chi
──────────────────────────────────────────────── */
interface CreateVoucherModalProps {
  type: 'receipt' | 'payment';
  partner: PartnerDetail;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateVoucherModal({ type, partner, onClose, onSuccess }: CreateVoucherModalProps) {
  const isReceipt = type === 'receipt';
  const [amount, setAmount]               = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [datetime, setDatetime]           = useState(nowDatetime());
  const [category, setCategory]           = useState('');
  const [note, setNote]                   = useState('');
  const [branch, setBranch]               = useState('');
  const [affectsKQKD, setAffectsKQKD]     = useState(true);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    amountRef.current?.focus();
    getMe().then((me) => {
      if (me?.branch) setBranch(me.branch);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(String(amount).replace(/[^0-9]/g, ''));
    if (!num || num <= 0) { setError('Vui lòng nhập số tiền hợp lệ'); return; }
    setSaving(true); setError('');
    try {
      await transactionsApi.create({
        type,
        amount: num,
        paymentMethod,
        date: datetime,
        category: category || undefined,
        note: note || undefined,
        partnerId: partner.id,
        branch: branch || undefined,
        affectsBusinessResult: affectsKQKD,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra');
    } finally {
      setSaving(false);
    }
  }

  const accent = isReceipt
    ? { header: 'bg-emerald-500', btn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200', ring: 'focus:ring-emerald-400' }
    : { header: 'bg-red-500',     btn: 'bg-red-500 hover:bg-red-600 shadow-red-200',             ring: 'focus:ring-red-400' };

  const CATEGORIES = isReceipt
    ? ['Thu tiền hàng', 'Thu công nợ', 'Thu đặt cọc', 'Hoàn trả từ NCC', 'Khác']
    : ['Chi trả hàng', 'Chi trả công nợ', 'Chi đặt cọc', 'Hoàn tiền KH', 'Chi phí vận chuyển', 'Khác'];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-6 px-4">
      {/* Overlay — nhẹ, không blur */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[calc(100vh-4rem)]">
        {/* ── Header cố định ── */}
        <div className={`${accent.header} px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-2xl`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              {isReceipt
                ? <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                : <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
              }
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isReceipt ? 'Tạo phiếu thu' : 'Tạo phiếu chi'}
              </h2>
              <p className="text-white/70 text-xs mt-0.5">
                {isReceipt ? 'Ghi nhận tiền thu vào' : 'Ghi nhận tiền chi ra'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body cuộn được ── */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

            {/* Hàng 1: Chi nhánh + Ngày giờ */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                  Chi nhánh <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="Chi nhánh mặc định"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Ngày ghi nhận</label>
                <input
                  type="datetime-local"
                  value={datetime}
                  onChange={(e) => setDatetime(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
              </div>
            </div>

            {/* Hàng 2: Đối tác + Số tiền */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Đối tác</label>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 h-[42px]">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {partner.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate leading-tight">{partner.name}</p>
                    <p className="text-[10px] text-gray-400 leading-tight">{partner.code}</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                  Giá trị <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    ref={amountRef}
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setAmount(raw ? Number(raw).toLocaleString('vi-VN') : '');
                    }}
                    placeholder="0"
                    className={`w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-8 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 ${accent.ring} focus:border-transparent placeholder:text-gray-300 placeholder:font-normal h-[42px]`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">đ</span>
                </div>
              </div>
            </div>

            {/* Hàng 3: PTTT + Lý do */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Hình thức TT</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white">
                  <option value="cash">Tiền mặt</option>
                  <option value="bank_transfer">Chuyển khoản</option>
                  <option value="momo">MoMo</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Lý do</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white">
                  <option value="">-- Chọn lý do --</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Ghi chú */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Mô tả</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)}
                rows={2} placeholder="Nhập mô tả (tùy chọn)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none placeholder:text-gray-300" />
            </div>

            {/* Hạch toán KQKD */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setAffectsKQKD((v) => !v)}
                className={`w-5 h-5 rounded border-2 transition flex items-center justify-center flex-shrink-0 ${
                  affectsKQKD ? 'border-blue-500 bg-blue-500' : 'border-gray-300 bg-white'
                }`}>
                {affectsKQKD && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-gray-700">Hạch toán kết quả kinh doanh</span>
            </label>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-sm text-red-500">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}
          </div>

          {/* ── Footer cố định ── */}
          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-50 transition">
              Hủy
            </button>
            <button type="submit" disabled={saving}
              className={`flex-1 py-2.5 text-white rounded-xl font-semibold text-sm transition shadow-sm disabled:opacity-60 ${accent.btn}`}>
              {saving ? 'Đang lưu...' : isReceipt ? 'Tạo phiếu thu' : 'Tạo phiếu chi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────
   Main page
──────────────────────────────────────────────── */
export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [partner, setPartner]       = useState<PartnerDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState<TabKey>('history');
  const [deleting, setDeleting]     = useState(false);

  // Voucher button dropdown
  const [showVoucherMenu, setShowVoucherMenu] = useState(false);
  const [voucherType, setVoucherType]         = useState<'receipt' | 'payment' | null>(null);
  const voucherMenuRef = useRef<HTMLDivElement>(null);

  // Transactions in debt tab
  const [txList, setTxList]         = useState<TxItem[]>([]);
  const [txLoading, setTxLoading]   = useState(false);
  const [txSummary, setTxSummary]   = useState({ totalReceipts: 0, totalPayments: 0 });

  // Orders in history tab
  const [orders, setOrders]         = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    partnersApi.getOne(Number(id))
      .then(setPartner)
      .catch(() => router.push('/dashboard/partners'))
      .finally(() => setLoading(false));
  }, [id, router]);

  // Close voucher dropdown on outside click
  useEffect(() => {
    function h(e: MouseEvent) {
      if (voucherMenuRef.current && !voucherMenuRef.current.contains(e.target as Node)) {
        setShowVoucherMenu(false);
      }
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Load transactions when switching to debt tab
  useEffect(() => {
    if (activeTab !== 'debt' || !id) return;
    loadTransactions();
  }, [activeTab, id]);

  // Load orders when switching to history tab
  useEffect(() => {
    if (activeTab !== 'history' || !id) return;
    setOrdersLoading(true);
    ordersApi.getAll({ customerId: id, limit: '50', sortBy: 'date', sortOrder: 'DESC' })
      .then((res: any) => setOrders(res.data || []))
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
  }, [activeTab, id]);

  async function loadTransactions() {
    setTxLoading(true);
    try {
      const [list, summary] = await Promise.all([
        transactionsApi.getAll({ partnerId: id }),
        transactionsApi.getPartnerSummary(Number(id)),
      ]);
      setTxList(list.data || []);
      setTxSummary(summary);
    } finally {
      setTxLoading(false);
    }
  }

  function openVoucher(type: 'receipt' | 'payment') {
    setVoucherType(type);
    setShowVoucherMenu(false);
  }

  function onVoucherSuccess() {
    setVoucherType(null);
    // Reload transactions if tab is open
    if (activeTab === 'debt') loadTransactions();
    // Refresh partner data to get updated debt
    partnersApi.getOne(Number(id)).then(setPartner);
  }

  async function handleDelete() {
    if (!confirm(`Xóa đối tác "${partner?.name}"?\n\nHành động này sẽ ẩn đối tác khỏi hệ thống.`)) return;
    setDeleting(true);
    try {
      await partnersApi.remove(Number(id));
      router.push('/dashboard/partners');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full bg-[#f5f6fa]">
      <div className="flex flex-col items-center gap-3 text-gray-300">
        <svg className="animate-spin w-7 h-7" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <span className="text-sm">Đang tải...</span>
      </div>
    </div>
  );

  if (!partner) return null;

  const rankStyle = RANK_STYLE[partner.rank] || RANK_STYLE.new;
  const debtRatio = Number(partner.creditLimit) > 0
    ? Math.min(100, Math.round(Number(partner.totalDebt) / Number(partner.creditLimit) * 100))
    : 0;

  return (
    <>
      {/* Voucher modal */}
      {voucherType && partner && (
        <CreateVoucherModal
          type={voucherType}
          partner={partner}
          onClose={() => setVoucherType(null)}
          onSuccess={onVoucherSuccess}
        />
      )}

      <div className="flex flex-col h-full bg-[#f5f6fa]">
        {/* ── Sticky header ── */}
        <div className="bg-white border-b border-gray-100 px-7 py-3.5 flex items-center gap-3 flex-shrink-0 sticky top-0 z-20">
          <Link href="/dashboard/partners"
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Quay lại
          </Link>
          <div className="h-4 w-px bg-gray-200" />
          <h1 className="text-base font-bold text-gray-900 truncate">{partner.name}</h1>
          <span className={`text-[11px] px-2 py-0.5 rounded font-semibold flex-shrink-0 ${TYPE_STYLE[partner.type]}`}>
            {TYPE_LABEL[partner.type]}
          </span>
          <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold flex-shrink-0 ${rankStyle.badge}`}>
            {partner.rank === 'vip' && '★ '}{RANK_LABEL[partner.rank]}
          </span>
          {!partner.isActive && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-red-50 text-red-400 border border-red-100 flex-shrink-0">Đã ngừng</span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Xóa */}
            <button onClick={handleDelete} disabled={deleting}
              className="px-3.5 py-1.5 text-sm border border-red-200 text-red-500 hover:bg-red-50 rounded-lg font-medium transition disabled:opacity-50">
              {deleting ? 'Đang xóa...' : 'Xóa đối tác'}
            </button>

            {/* Tạo phiếu thu/chi — split button */}
            <div className="relative flex" ref={voucherMenuRef}>
              <button onClick={() => openVoucher('receipt')}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-l-lg transition shadow-sm shadow-blue-200">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Tạo phiếu thu/chi
              </button>
              <button onClick={() => setShowVoucherMenu((v) => !v)}
                className="inline-flex items-center justify-center bg-blue-700 hover:bg-blue-800 text-white px-2 py-1.5 rounded-r-lg border-l border-blue-500 transition">
                <svg className={`w-3.5 h-3.5 transition-transform ${showVoucherMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showVoucherMenu && (
                <div className="absolute right-0 top-full mt-1.5 z-30 bg-white shadow-xl rounded-xl border border-gray-100 w-52 py-1.5">
                  <button onClick={() => openVoucher('receipt')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 transition group">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center transition">
                      <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-800">Phiếu thu</p>
                      <p className="text-[11px] text-gray-400">Ghi nhận tiền thu vào</p>
                    </div>
                  </button>
                  <button onClick={() => openVoucher('payment')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 transition group">
                    <div className="w-7 h-7 rounded-lg bg-red-100 group-hover:bg-red-200 flex items-center justify-center transition">
                      <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-800">Phiếu chi</p>
                      <p className="text-[11px] text-gray-400">Ghi nhận tiền chi ra</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Sửa */}
            <Link href={`/dashboard/partners/${partner.id}/edit`}
              className="px-4 py-1.5 text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg font-medium transition">
              Sửa thông tin
            </Link>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-auto px-6 py-5">
          <div className="grid grid-cols-3 gap-4 max-w-7xl mx-auto">

            {/* Left column (2/3) */}
            <div className="col-span-2 space-y-4">

              {/* Thông tin cơ bản */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    <h2 className="font-semibold text-gray-800">Thông tin cơ bản</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${partner.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                      {partner.isActive ? 'Đang hoạt động' : 'Đã ngừng'}
                    </span>
                  </div>
                  <Link href={`/dashboard/partners/${partner.id}/edit`}
                    className="text-sm text-blue-500 hover:text-blue-700 font-medium transition">Cập nhật</Link>
                </div>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-5 p-6">
                  <Field label="Mã đối tác" value={
                    <span className="font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[13px]">{partner.code}</span>
                  } />
                  <Field label="Loại đối tác" value={
                    <span className={`text-[12px] px-2 py-0.5 rounded font-semibold ${TYPE_STYLE[partner.type]}`}>{TYPE_LABEL[partner.type]}</span>
                  } />
                  <Field label="Số điện thoại" value={partner.phone && (
                    <a href={`tel:${partner.phone}`} className="text-blue-600 hover:underline">{partner.phone}</a>
                  )} />
                  <Field label="Email" value={partner.email && (
                    <a href={`mailto:${partner.email}`} className="text-blue-600 hover:underline">{partner.email}</a>
                  )} />
                  {partner.customerType === 'individual' ? (
                    <>
                      <Field label="Ngày sinh" value={partner.birthday} />
                      <Field label="Giới tính" value={partner.gender ? GENDER_LABEL[partner.gender] : undefined} />
                    </>
                  ) : (
                    <>
                      <Field label="Mã số thuế" value={partner.taxCode} />
                      <Field label="Website" value={partner.website && (
                        <a href={partner.website} target="_blank" rel="noopener" className="text-blue-600 hover:underline truncate block max-w-[200px]">{partner.website}</a>
                      )} />
                    </>
                  )}
                  <Field label="Người liên hệ" value={partner.contactPerson} />
                  <Field label="Nhóm đối tác" value={partner.group} />
                  <Field label="Nguồn khách" value={partner.source} />
                  <Field label="Nhân viên phụ trách" value={partner.assignedStaff && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[9px] font-bold flex items-center justify-center">
                        {partner.assignedStaff.name.charAt(0)}
                      </span>
                      {partner.assignedStaff.name}
                    </span>
                  )} />
                  <Field label="Ngày tạo" value={new Date(partner.createdAt).toLocaleDateString('vi-VN')} />
                  <Field label="Cập nhật lần cuối" value={new Date(partner.updatedAt).toLocaleDateString('vi-VN')} />
                </dl>
              </div>

              {/* Thống kê giao dịch */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-semibold text-gray-800 mb-4">Thông tin giao dịch</h2>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Tổng chi tiêu"
                    value={<span className="text-emerald-600">{fmt(partner.totalRevenue)}</span>} />
                  <StatCard label="Tổng đơn hàng"
                    value={<span className="text-blue-600">{partner.totalOrders || 0}</span>}
                    sub="đơn hàng đã đặt" />
                  <StatCard label="Công nợ hiện tại"
                    value={<span className={Number(partner.totalDebt) > 0 ? 'text-red-500' : 'text-gray-400'}>
                      {fmt(partner.totalDebt)}
                    </span>} />
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="flex border-b border-gray-100 overflow-x-auto">
                  {TABS.map((tab) => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                      className={`px-5 py-3 text-sm font-medium flex-shrink-0 border-b-2 transition-colors ${
                        activeTab === tab.key
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-400 hover:text-gray-600'
                      }`}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="p-6">
                  {/* Lịch sử đơn hàng */}
                  {activeTab === 'history' && (() => {
                    const STATUS_LABEL: Record<string, string> = {
                      pending: 'Chờ xử lý', processing: 'Đang xử lý',
                      completed: 'Hoàn thành', cancelled: 'Đã hủy',
                    };
                    const STATUS_STYLE: Record<string, string> = {
                      pending: 'bg-yellow-50 text-yellow-600 border-yellow-200',
                      processing: 'bg-blue-50 text-blue-600 border-blue-200',
                      completed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                      cancelled: 'bg-gray-100 text-gray-400 border-gray-200',
                    };
                    const PAY_LABEL: Record<string, string> = {
                      unpaid: 'Chưa TT', partial: 'TT một phần', paid: 'Đã TT',
                    };
                    const PAY_STYLE: Record<string, string> = {
                      unpaid: 'text-red-500', partial: 'text-amber-500', paid: 'text-emerald-600',
                    };
                    if (ordersLoading) return (
                      <div className="flex items-center justify-center py-10 text-gray-300">
                        <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Đang tải...
                      </div>
                    );
                    if (orders.length === 0) return (
                      <div className="text-center py-10">
                        <svg className="w-12 h-12 mx-auto text-gray-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p className="text-gray-300 text-sm">Chưa có đơn hàng nào</p>
                      </div>
                    );
                    return (
                      <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Mã đơn</th>
                              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Ngày</th>
                              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Thanh toán</th>
                              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tổng tiền</th>
                              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Còn nợ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orders.map((o) => (
                              <tr key={o.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition">
                                <td className="px-4 py-3">
                                  <a href={`/dashboard/orders/${o.id}`}
                                    className="font-mono text-[11px] bg-blue-50 text-blue-500 hover:bg-blue-100 px-2 py-1 rounded-md tracking-wide transition">
                                    {o.code}
                                  </a>
                                </td>
                                <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-[12px]">
                                  {new Date(o.date).toLocaleDateString('vi-VN')}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLE[o.status] || 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                    {STATUS_LABEL[o.status] || o.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-[12px] font-medium ${PAY_STYLE[o.paymentStatus] || 'text-gray-400'}`}>
                                    {PAY_LABEL[o.paymentStatus] || o.paymentStatus}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-gray-700 text-[13px]">
                                  {Number(o.totalAmount).toLocaleString('vi-VN')}đ
                                </td>
                                <td className="px-4 py-3 text-right text-[13px]">
                                  {Number(o.debtAmount) > 0
                                    ? <span className="font-semibold text-red-500">{Number(o.debtAmount).toLocaleString('vi-VN')}đ</span>
                                    : <span className="text-gray-300">0đ</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {orders.length >= 50 && (
                          <div className="px-4 py-2.5 border-t border-gray-50 text-center">
                            <a href={`/dashboard/orders?customerId=${id}`}
                              className="text-xs text-blue-500 hover:underline font-medium">
                              Xem tất cả đơn hàng →
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Công nợ & Phiếu */}
                  {activeTab === 'debt' && (
                    <div>
                      {/* Summary row */}
                      <div className="grid grid-cols-3 gap-3 mb-5">
                        <div className="bg-emerald-50 rounded-xl p-3.5">
                          <p className="text-[11px] text-emerald-600 font-medium uppercase tracking-wide">Tổng thu</p>
                          <p className="text-lg font-bold text-emerald-700 mt-0.5">{fmt(txSummary.totalReceipts)}</p>
                        </div>
                        <div className="bg-red-50 rounded-xl p-3.5">
                          <p className="text-[11px] text-red-500 font-medium uppercase tracking-wide">Tổng chi</p>
                          <p className="text-lg font-bold text-red-600 mt-0.5">{fmt(txSummary.totalPayments)}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3.5">
                          <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">Công nợ</p>
                          <p className={`text-lg font-bold mt-0.5 ${Number(partner.totalDebt) > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                            {fmt(partner.totalDebt)}
                          </p>
                        </div>
                      </div>

                      {/* Quick create buttons */}
                      <div className="flex items-center gap-2 mb-4">
                        <button onClick={() => openVoucher('receipt')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold transition">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                          </svg>
                          Tạo phiếu thu
                        </button>
                        <button onClick={() => openVoucher('payment')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-semibold transition">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                          </svg>
                          Tạo phiếu chi
                        </button>
                      </div>

                      {/* Transaction list */}
                      {txLoading ? (
                        <div className="flex items-center justify-center py-8 text-gray-300">
                          <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          Đang tải...
                        </div>
                      ) : txList.length === 0 ? (
                        <div className="text-center py-8 border-t border-gray-50">
                          <p className="text-gray-300 text-sm">Chưa có phiếu thu/chi nào</p>
                        </div>
                      ) : (
                        <div className="border border-gray-100 rounded-xl overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Mã phiếu</th>
                                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Loại</th>
                                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Lý do</th>
                                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">PTTT</th>
                                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Ngày</th>
                                <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Số tiền</th>
                              </tr>
                            </thead>
                            <tbody>
                              {txList.map((tx) => (
                                <tr key={tx.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition">
                                  <td className="px-4 py-3">
                                    <span className="font-mono text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{tx.code}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                                      tx.type === 'receipt'
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                        : 'bg-red-50 text-red-500 border-red-100'
                                    }`}>
                                      {tx.type === 'receipt' ? '↑ Thu' : '↓ Chi'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-gray-600">{tx.category || tx.note || <span className="text-gray-300">—</span>}</td>
                                  <td className="px-4 py-3 text-gray-500">{PM_LABEL[tx.paymentMethod] || tx.paymentMethod}</td>
                                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                    {new Date(tx.date).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className={`px-4 py-3 text-right font-semibold ${tx.type === 'receipt' ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {tx.type === 'receipt' ? '+' : '-'}{Number(tx.amount).toLocaleString('vi-VN')}đ
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Liên hệ */}
                  {activeTab === 'contact' && (
                    <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
                      <Field label="Người liên hệ" value={partner.contactPerson} />
                      <Field label="Số điện thoại" value={partner.phone && (
                        <a href={`tel:${partner.phone}`} className="text-blue-600 hover:underline">{partner.phone}</a>
                      )} />
                      <Field label="Email" value={partner.email && (
                        <a href={`mailto:${partner.email}`} className="text-blue-600 hover:underline">{partner.email}</a>
                      )} />
                      <Field label="Website" value={partner.website && (
                        <a href={partner.website} target="_blank" rel="noopener" className="text-blue-600 hover:underline">{partner.website}</a>
                      )} />
                      {partner.socialLinks && Object.entries(partner.socialLinks).map(([k, v]) => (
                        <Field key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} value={
                          <a href={v} target="_blank" rel="noopener" className="text-blue-600 hover:underline truncate block max-w-xs">{v}</a>
                        } />
                      ))}
                    </dl>
                  )}

                  {/* Địa chỉ */}
                  {activeTab === 'address' && (
                    <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
                      <Field label="Tỉnh / Thành phố" value={partner.province} />
                      <Field label="Địa chỉ chi tiết" value={partner.address} />
                    </dl>
                  )}

                  {/* Ghi chú */}
                  {activeTab === 'notes' && (
                    partner.notes
                      ? <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{partner.notes}</p>
                      : <p className="text-gray-300 text-sm text-center py-6">Chưa có ghi chú nào</p>
                  )}

                  {/* Ngân hàng */}
                  {activeTab === 'bank' && (
                    <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
                      <Field label="Số tài khoản" value={partner.bankAccount && (
                        <span className="font-mono text-sm">{partner.bankAccount}</span>
                      )} />
                      <Field label="Ngân hàng" value={partner.bankName} />
                      {partner.paymentTerm && (
                        <Field label="Kỳ thanh toán" value={`${partner.paymentTerm} ngày`} />
                      )}
                    </dl>
                  )}
                </div>
              </div>
            </div>

            {/* Right sidebar (1/3) */}
            <div className="space-y-4">
              {/* Hạng đối tác */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-semibold text-gray-800 mb-4">Hạng đối tác</h3>
                <div className={`${rankStyle.bg} rounded-xl p-4 text-center mb-4`}>
                  <p className={`text-3xl font-bold ${rankStyle.text}`}>
                    {partner.rank === 'vip' && '★ '}{RANK_LABEL[partner.rank]}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 font-medium">Hạng hiện tại</p>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tổng đơn hàng</span>
                    <span className="font-semibold text-gray-800">{partner.totalOrders || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tổng chi tiêu</span>
                    <span className="font-semibold text-emerald-600">{fmt(partner.totalRevenue)}</span>
                  </div>
                </div>
              </div>

              {/* Tài chính */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-semibold text-gray-800 mb-4">Tài chính</h3>
                <div className="space-y-3">
                  {/* KH nợ mình — hiện với customer/both */}
                  {(partner.type === 'customer' || partner.type === 'both') && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Hạn mức công nợ</span>
                        <span className="font-semibold text-gray-800">{fmt(partner.creditLimit)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">KH đang nợ</span>
                        <span className={`font-semibold ${Number(partner.totalDebt) > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          {fmt(partner.totalDebt)}
                        </span>
                      </div>
                      {Number(partner.creditLimit) > 0 && (
                        <div>
                          <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                            <span>Tỉ lệ sử dụng</span><span>{debtRatio}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${debtRatio > 80 ? 'bg-red-400' : debtRatio > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                              style={{ width: `${debtRatio}%` }} />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {/* Mình nợ NCC/VC — hiện với supplier/both/freight */}
                  {(partner.type === 'supplier' || partner.type === 'both' || partner.type === 'freight') && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Mình đang nợ</span>
                      <span className={`font-semibold ${Number(partner.supplierDebt) > 0 ? 'text-violet-600' : 'text-gray-400'}`}>
                        {fmt(partner.supplierDebt)}
                      </span>
                    </div>
                  )}
                  {partner.paymentTerm && (
                    <div className="flex justify-between text-sm pt-2 border-t border-gray-50">
                      <span className="text-gray-500">Kỳ thanh toán</span>
                      <span className="font-semibold text-gray-800">{partner.paymentTerm} ngày</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Nhân viên phụ trách */}
              {partner.assignedStaff && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-semibold text-gray-800 mb-3">Nhân viên phụ trách</h3>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-indigo-600 font-bold text-sm">{partner.assignedStaff.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{partner.assignedStaff.name}</p>
                      {partner.assignedStaff.email && (
                        <p className="text-xs text-gray-400">{partner.assignedStaff.email}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Ngân hàng */}
              {partner.bankAccount && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-semibold text-gray-800 mb-3">Tài khoản ngân hàng</h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[11px] text-gray-400 uppercase tracking-wide">Số tài khoản</p>
                      <p className="font-mono text-sm font-semibold text-gray-800 mt-0.5">{partner.bankAccount}</p>
                    </div>
                    {partner.bankName && (
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase tracking-wide">Ngân hàng</p>
                        <p className="text-sm text-gray-700 mt-0.5">{partner.bankName}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
