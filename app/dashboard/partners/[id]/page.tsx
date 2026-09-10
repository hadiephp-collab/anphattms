'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { partnersApi } from '@/lib/partners';
import { transactionsApi, PM_LABEL } from '@/lib/transactions';
import { ordersApi } from '@/lib/orders';
import { purchaseOrdersApi } from '@/lib/purchase-orders';
import { getMe } from '@/lib/auth';

const RANK_LABEL: Record<string, string> = { new: 'Mới', normal: 'Thường', loyal: 'Thân thiết', vip: 'VIP' };
const RANK_STYLE: Record<string, { badge: string; bg: string; text: string }> = {
  new:    { badge: 'bg-gray-100 text-gray-500 border border-gray-200',         bg: 'bg-gray-50',    text: 'text-gray-500' },
  normal: { badge: 'bg-sky-50 text-sky-600 border border-sky-100',             bg: 'bg-sky-50',     text: 'text-sky-600' },
  loyal:  { badge: 'bg-emerald-50 text-emerald-600 border border-emerald-100', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  vip:    { badge: 'bg-amber-50 text-amber-500 border border-amber-200',       bg: 'bg-amber-50',   text: 'text-amber-500' },
};
const TYPE_LABEL: Record<string, string> = { customer: 'Khách hàng', supplier: 'Nhà cung cấp', both: 'KH + NCC', freight: 'Vận chuyển' };
const TYPE_STYLE: Record<string, string> = {
  customer: 'bg-blue-50 text-blue-600',
  supplier: 'bg-violet-50 text-violet-600',
  both:     'bg-teal-50 text-teal-600',
  freight:  'bg-orange-50 text-orange-600',
};
const GENDER_LABEL: Record<string, string> = { male: 'Nam', female: 'Nữ', other: 'Khác' };

interface PartnerDetail {
  id: number; code: string; name: string; type: string; customerType: string;
  phone?: string; contactPhone2?: string; email?: string;
  address?: string; province?: string; deliveryAddress?: string; taxAddress?: string;
  taxCode?: string; contactPerson?: string; birthday?: string; gender?: string;
  group?: string; rank: string; source?: string; rating?: number; currency?: string;
  creditLimit: number; totalDebt: number; supplierDebt?: number; totalOrders: number; totalRevenue: number; totalPurchase?: number;
  paymentTerm?: number; bankAccount?: string; bankName?: string;
  bankAccountHolder?: string; bankBranch?: string;
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

type TabKey = 'info' | 'history' | 'debt';

const inputCls = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-300 bg-white';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-3">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{children}</span>
      <div className="flex-1 border-t border-gray-100" />
    </div>
  );
}

function FieldItem({ label, value, mono = false }: { label: string; value?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      {value != null && value !== ''
        ? <p className={`text-sm ${mono ? 'font-mono text-gray-600' : 'text-gray-800'}`}>{value}</p>
        : <p className="text-sm text-gray-300">—</p>
      }
    </div>
  );
}

function fmt(n?: number | string) {
  const num = Number(n ?? 0);
  return num > 0 ? `${num.toLocaleString('vi-VN')}đ` : '0đ';
}

function fmtDate(s?: string) {
  if (!s) return '';
  return new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const nowDatetime = () => {
  const d = new Date();
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
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[calc(100vh-4rem)]">
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

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                  Chi nhánh <span className="text-red-400">*</span>
                </label>
                <input type="text" value={branch} onChange={(e) => setBranch(e.target.value)}
                  placeholder="Chi nhánh mặc định"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-gray-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Ngày ghi nhận</label>
                <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent" />
              </div>
            </div>

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
                  <input ref={amountRef} type="text" inputMode="numeric" value={amount}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setAmount(raw ? Number(raw).toLocaleString('vi-VN') : '');
                    }}
                    placeholder="0"
                    className={`w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-8 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 ${accent.ring} focus:border-transparent placeholder:text-gray-300 placeholder:font-normal h-[42px]`} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">đ</span>
                </div>
              </div>
            </div>

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

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Mô tả</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)}
                rows={2} placeholder="Nhập mô tả (tùy chọn)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none placeholder:text-gray-300" />
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div onClick={() => setAffectsKQKD((v) => !v)}
                className={`w-5 h-5 rounded border-2 transition flex items-center justify-center flex-shrink-0 ${affectsKQKD ? 'border-blue-500 bg-blue-500' : 'border-gray-300 bg-white'}`}>
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

  const [partner, setPartner]     = useState<PartnerDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [deleting, setDeleting]   = useState(false);

  // Voucher button dropdown
  const [showVoucherMenu, setShowVoucherMenu] = useState(false);
  const [voucherType, setVoucherType]         = useState<'receipt' | 'payment' | null>(null);
  const voucherMenuRef = useRef<HTMLDivElement>(null);

  // Transactions in debt tab
  const [txList, setTxList]       = useState<TxItem[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txSummary, setTxSummary] = useState({ totalReceipts: 0, totalPayments: 0 });
  const [txFrom, setTxFrom]           = useState('');
  const [txTo, setTxTo]               = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState('');

  // Orders in history tab
  const [orders, setOrders]               = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Purchase stats (for suppliers)
  const [purchaseStats, setPurchaseStats]   = useState<any>(null);
  const [purchasePeriod, setPurchasePeriod] = useState<'all'|'1m'|'3m'|'6m'|'1y'>('all');

  // Inline edit state
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState('');

  // Edit form fields
  const [eName, setEName]                     = useState('');
  const [ePhone, setEPhone]                   = useState('');
  const [ePhone2, setEPhone2]                 = useState('');
  const [eEmail, setEEmail]                   = useState('');
  const [eContactPerson, setEContactPerson]   = useState('');
  const [eWebsite, setEWebsite]               = useState('');
  const [eZalo, setEZalo]                     = useState('');
  const [eFacebook, setEFacebook]             = useState('');
  const [eProvince, setEProvince]             = useState('');
  const [eAddress, setEAddress]               = useState('');
  const [eDeliveryAddress, setEDeliveryAddress] = useState('');
  const [eTaxAddress, setETaxAddress]         = useState('');
  const [eGroup, setEGroup]                   = useState('');
  const [eSource, setESource]                 = useState('');
  const [eCustomerType, setECustomerType]     = useState('');
  const [eCurrency, setECurrency]             = useState('');
  const [ePaymentTerm, setEPaymentTerm]       = useState('');
  const [eTaxCode, setETaxCode]               = useState('');
  const [eNotes, setENotes]                   = useState('');
  const [eBankAccount, setEBankAccount]       = useState('');
  const [eBankName, setEBankName]             = useState('');
  const [eBankHolder, setEBankHolder]         = useState('');
  const [eBankBranch, setEBankBranch]         = useState('');
  const [eRank, setERank]                     = useState('');
  const [eIsActive, setEIsActive]             = useState(true);
  const [eRating, setERating]                 = useState('');

  useEffect(() => {
    partnersApi.getOne(Number(id))
      .then((p) => {
        setPartner(p);
        if (p.type === 'supplier' || p.type === 'both' || p.type === 'freight') {
          partnersApi.getPurchaseStats(Number(id)).then(setPurchaseStats).catch(() => {});
        }
      })
      .catch(() => router.push('/dashboard/partners'))
      .finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (voucherMenuRef.current && !voucherMenuRef.current.contains(e.target as Node)) {
        setShowVoucherMenu(false);
      }
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (activeTab !== 'debt' || !id) return;
    loadTransactions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id, txFrom, txTo, txTypeFilter]);

  useEffect(() => {
    if (activeTab !== 'history' || !id || !partner) return;
    setOrdersLoading(true);
    const type = partner.type;
    const isSupplier = type === 'supplier' || type === 'freight';
    const isCustomer = type === 'customer';
    const isBoth = type === 'both';

    const fetchSales = isCustomer || isBoth
      ? ordersApi.getAll({ customerId: id, limit: '50', sortBy: 'date', sortOrder: 'DESC' })
          .then((res: any) => setOrders(res.data || []))
      : Promise.resolve();

    const fetchPO = isSupplier || isBoth
      ? purchaseOrdersApi.getAll({ supplierId: id, limit: '50', sortBy: 'date', sortOrder: 'DESC' })
          .then((res: any) => setPurchaseOrders(res.data || res || []))
      : Promise.resolve();

    Promise.all([fetchSales, fetchPO])
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
  }, [activeTab, id, partner]);

  async function loadTransactions() {
    setTxLoading(true);
    try {
      const params: Record<string, string> = { partnerId: id };
      if (txFrom) params.dateFrom = txFrom;
      if (txTo)   params.dateTo   = txTo;
      if (txTypeFilter) params.type = txTypeFilter;
      const [list, summary] = await Promise.all([
        transactionsApi.getAll(params),
        transactionsApi.getPartnerSummary(Number(id)),
      ]);
      setTxList(list.data || []);
      setTxSummary(summary);
    } finally {
      setTxLoading(false);
    }
  }

  function startEditing() {
    if (!partner) return;
    setEName(partner.name || '');
    setEPhone(partner.phone || '');
    setEPhone2(partner.contactPhone2 || '');
    setEEmail(partner.email || '');
    setEContactPerson(partner.contactPerson || '');
    setEWebsite(partner.website || '');
    const social = (partner.socialLinks as Record<string, string>) || {};
    setEZalo(social.zalo || '');
    setEFacebook(social.facebook || '');
    setEProvince(partner.province || '');
    setEAddress(partner.address || '');
    setEDeliveryAddress(partner.deliveryAddress || '');
    setETaxAddress(partner.taxAddress || '');
    setEGroup(partner.group || '');
    setESource(partner.source || '');
    setECustomerType(partner.customerType || '');
    setECurrency(partner.currency || '');
    setEPaymentTerm(partner.paymentTerm ? String(partner.paymentTerm) : '');
    setETaxCode(partner.taxCode || '');
    setENotes(partner.notes || '');
    setEBankAccount(partner.bankAccount || '');
    setEBankName(partner.bankName || '');
    setEBankHolder(partner.bankAccountHolder || '');
    setEBankBranch(partner.bankBranch || '');
    setERank(partner.rank || 'new');
    setEIsActive(partner.isActive);
    setERating(partner.rating ? String(partner.rating) : '');
    setIsEditing(true);
    setActiveTab('info');
    setSaveError('');
  }

  function cancelEditing() {
    setIsEditing(false);
    setSaveError('');
  }

  async function handleSave() {
    if (!partner || !eName.trim()) { setSaveError('Tên không được để trống'); return; }
    setSaving(true); setSaveError('');
    try {
      await partnersApi.update(partner.id, {
        name: eName.trim(),
        phone: ePhone || undefined,
        contactPhone2: ePhone2 || undefined,
        email: eEmail || undefined,
        contactPerson: eContactPerson || undefined,
        website: eWebsite || undefined,
        socialLinks: (eZalo || eFacebook)
          ? { ...(eZalo ? { zalo: eZalo } : {}), ...(eFacebook ? { facebook: eFacebook } : {}) }
          : undefined,
        province: eProvince || undefined,
        address: eAddress || undefined,
        deliveryAddress: eDeliveryAddress || undefined,
        taxAddress: eTaxAddress || undefined,
        group: eGroup || undefined,
        source: eSource || undefined,
        customerType: eCustomerType || undefined,
        currency: eCurrency || undefined,
        paymentTerm: ePaymentTerm ? Number(ePaymentTerm) : undefined,
        taxCode: eTaxCode || undefined,
        notes: eNotes || undefined,
        bankAccount: eBankAccount || undefined,
        bankName: eBankName || undefined,
        bankAccountHolder: eBankHolder || undefined,
        bankBranch: eBankBranch || undefined,
        rank: eRank || undefined,
        isActive: eIsActive,
        rating: eRating ? Number(eRating) : undefined,
      });
      const updated = await partnersApi.getOne(partner.id);
      setPartner(updated);
      setIsEditing(false);
    } catch (err: any) {
      setSaveError(err.message || 'Có lỗi khi lưu');
    } finally {
      setSaving(false);
    }
  }

  function openVoucher(type: 'receipt' | 'payment') {
    setVoucherType(type);
    setShowVoucherMenu(false);
  }

  function onVoucherSuccess() {
    setVoucherType(null);
    if (activeTab === 'debt') loadTransactions();
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
  const isSupplier = partner.type === 'supplier' || partner.type === 'both' || partner.type === 'freight';
  const isCustomer = partner.type === 'customer' || partner.type === 'both';
  const hasBankInfo = !!(partner.bankAccount || partner.bankAccountHolder);

  // Supplier stats helpers
  const psVal = (field: 'total' | 'orders') => {
    if (!purchaseStats) return 0;
    const map = { all: ['totalAll', 'totalOrders'], '1m': ['total1m', 'orders1m'], '3m': ['total3m', 'orders3m'], '6m': ['total6m', 'orders6m'], '1y': ['total1y', 'orders1y'] };
    return purchaseStats[map[purchasePeriod][field === 'total' ? 0 : 1]] || 0;
  };

  return (
    <>
      {voucherType && partner && (
        <CreateVoucherModal type={voucherType} partner={partner} onClose={() => setVoucherType(null)} onSuccess={onVoucherSuccess} />
      )}

      <div className="flex flex-col h-full bg-[#f5f6fa]">
        {/* ── Sticky header ── */}
        <div className={`bg-white border-b px-5 py-3 flex items-center gap-2.5 flex-shrink-0 sticky top-0 z-20 transition-colors ${isEditing ? 'border-amber-200' : 'border-gray-100'}`}>
          <Link href="/dashboard/partners"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          <span className="font-mono text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded flex-shrink-0">{partner.code}</span>
          <h1 className="text-base font-bold text-gray-900 truncate">{isEditing ? eName || partner.name : partner.name}</h1>

          <span className={`text-[11px] px-2 py-0.5 rounded font-semibold flex-shrink-0 ${TYPE_STYLE[partner.type] || 'bg-gray-100 text-gray-500'}`}>
            {TYPE_LABEL[partner.type] || partner.type}
          </span>
          <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold flex-shrink-0 ${rankStyle.badge}`}>
            {partner.rank === 'vip' && '★ '}{RANK_LABEL[partner.rank]}
          </span>
          {!partner.isActive && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-red-50 text-red-400 border border-red-100 flex-shrink-0">Đã ngừng</span>
          )}
          {isEditing && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-500 border border-amber-200 flex-shrink-0">Đang chỉnh sửa</span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {!isEditing && (
              <>
                <button onClick={handleDelete} disabled={deleting}
                  className="px-3 py-1.5 text-sm border border-red-200 text-red-500 hover:bg-red-50 rounded-lg font-medium transition disabled:opacity-50">
                  {deleting ? 'Đang xóa...' : 'Xóa'}
                </button>

                {/* Tạo phiếu — nút đơn hoặc split button tùy loại đối tác */}
                {partner.type === 'both' ? (
                  <div className="relative flex" ref={voucherMenuRef}>
                    <button onClick={() => openVoucher('receipt')}
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3.5 py-1.5 rounded-l-lg transition shadow-sm shadow-blue-200">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Tạo phiếu
                    </button>
                    <button onClick={() => setShowVoucherMenu((v) => !v)}
                      className="inline-flex items-center justify-center bg-blue-700 hover:bg-blue-800 text-white px-2 py-1.5 rounded-r-lg border-l border-blue-500 transition">
                      <svg className={`w-3.5 h-3.5 transition-transform ${showVoucherMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showVoucherMenu && (
                      <div className="absolute right-0 top-full mt-1.5 z-30 bg-white shadow-xl rounded-xl border border-gray-100 w-48 py-1.5">
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
                ) : (
                  <button
                    onClick={() => openVoucher(partner.type === 'customer' ? 'receipt' : 'payment')}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3.5 py-1.5 rounded-lg transition shadow-sm shadow-blue-200">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {partner.type === 'customer' ? 'Tạo phiếu thu' : 'Tạo phiếu chi'}
                  </button>
                )}

                <button onClick={startEditing}
                  className="px-4 py-1.5 text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg font-medium transition">
                  Chỉnh sửa
                </button>
              </>
            )}

            {isEditing && (
              <>
                <button onClick={cancelEditing} disabled={saving}
                  className="px-3.5 py-1.5 text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg font-medium transition">
                  Hủy
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-semibold transition shadow-sm shadow-blue-200 disabled:opacity-60">
                  {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-auto px-4 py-4">
          <div className="grid grid-cols-3 gap-4">

            {/* ── Main panel (col-span-2) ── */}
            <div className="col-span-2">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                {/* Tab bar */}
                <div className="flex border-b border-gray-100">
                  {(['info', 'history', 'debt'] as TabKey[]).map((key) => {
                    const label = key === 'info' ? 'Thông tin' : key === 'history' ? 'Lịch sử đơn' : 'Công nợ & Phiếu';
                    return (
                      <button key={key} onClick={() => setActiveTab(key)}
                        className={`px-5 py-3 text-sm font-medium flex-shrink-0 border-b-2 transition-colors ${
                          activeTab === key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}>
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="p-6">
                  {/* ── Tab: Thông tin ── */}
                  {activeTab === 'info' && !isEditing && (
                    <div>
                      {saveError && (
                        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-sm text-red-500">
                          {saveError}
                        </div>
                      )}

                      <SectionLabel>Liên hệ</SectionLabel>
                      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                        <FieldItem label="Số điện thoại" value={partner.phone && (
                          <a href={`tel:${partner.phone}`} className="text-blue-600 hover:underline">{partner.phone}</a>
                        )} />
                        <FieldItem label="Email" value={partner.email && (
                          <a href={`mailto:${partner.email}`} className="text-blue-600 hover:underline">{partner.email}</a>
                        )} />
                        <FieldItem label="Người liên hệ" value={partner.contactPerson} />
                        <FieldItem label="Điện thoại 2" value={partner.contactPhone2 && (
                          <a href={`tel:${partner.contactPhone2}`} className="text-blue-600 hover:underline">{partner.contactPhone2}</a>
                        )} />
                        <FieldItem label="Website" value={partner.website && (
                          <a href={partner.website} target="_blank" rel="noopener" className="text-blue-600 hover:underline truncate block">{partner.website}</a>
                        )} />
                        <FieldItem label="Zalo" value={partner.socialLinks?.zalo} />
                        <FieldItem label="Facebook" value={partner.socialLinks?.facebook && (
                          <a href={partner.socialLinks.facebook} target="_blank" rel="noopener" className="text-blue-600 hover:underline truncate block">{partner.socialLinks.facebook}</a>
                        )} />
                      </div>

                      <SectionLabel>Địa chỉ</SectionLabel>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        <FieldItem label="Tỉnh / Thành phố" value={partner.province} />
                        <FieldItem label="Địa chỉ chi tiết" value={partner.address} />
                        <FieldItem label="Địa chỉ giao hàng / kho" value={partner.deliveryAddress} />
                        <FieldItem label="Địa chỉ trên hóa đơn VAT" value={partner.taxAddress} />
                      </div>

                      <SectionLabel>Thông tin kinh doanh</SectionLabel>
                      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                        <FieldItem label="Nhóm đối tác" value={partner.group} />
                        <FieldItem label="Nguồn khách" value={partner.source} />
                        <FieldItem label="Phân loại KH" value={partner.customerType} />
                        <FieldItem label="Tiền tệ" value={partner.currency || 'VND'} />
                        <FieldItem label="Kỳ thanh toán" value={partner.paymentTerm ? `${partner.paymentTerm} ngày` : undefined} />
                        <FieldItem label="Mã số thuế" value={partner.taxCode} mono />
                      </div>

                      {partner.notes && (
                        <>
                          <SectionLabel>Ghi chú</SectionLabel>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{partner.notes}</p>
                        </>
                      )}

                      {hasBankInfo && (
                        <>
                          <SectionLabel>Ngân hàng</SectionLabel>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                            <FieldItem label="Số tài khoản" value={partner.bankAccount} mono />
                            <FieldItem label="Ngân hàng" value={partner.bankName} />
                            <FieldItem label="Tên chủ tài khoản" value={partner.bankAccountHolder} />
                            <FieldItem label="Chi nhánh NH" value={partner.bankBranch} />
                          </div>
                        </>
                      )}

                      <div className="flex items-center gap-2 mt-6 pt-4 border-t border-gray-50">
                        <span className="text-[11px] text-gray-300">Tạo {fmtDate(partner.createdAt)}</span>
                        <span className="text-gray-200">·</span>
                        <span className="text-[11px] text-gray-300">Cập nhật {fmtDate(partner.updatedAt)}</span>
                      </div>
                    </div>
                  )}

                  {/* ── Tab: Thông tin (EDIT MODE) ── */}
                  {activeTab === 'info' && isEditing && (
                    <div>
                      {saveError && (
                        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-sm text-red-500">
                          {saveError}
                        </div>
                      )}

                      <div className="mb-4">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Tên đối tác <span className="text-red-400">*</span></label>
                        <input value={eName} onChange={(e) => setEName(e.target.value)} className={inputCls} placeholder="Tên đối tác" />
                      </div>

                      <div className="flex items-center gap-3 mb-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <div onClick={() => setEIsActive((v) => !v)}
                            className={`w-4.5 h-4.5 w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition ${eIsActive ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 bg-white'}`}>
                            {eIsActive && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span className="text-sm text-gray-700">Đang hoạt động</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hạng:</span>
                          <select value={eRank} onChange={(e) => setERank(e.target.value)}
                            className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                            {Object.entries(RANK_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Đánh giá:</span>
                          <select value={eRating} onChange={(e) => setERating(e.target.value)}
                            className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                            <option value="">—</option>
                            {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n} ★</option>)}
                          </select>
                        </div>
                      </div>

                      <SectionLabel>Liên hệ</SectionLabel>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Số điện thoại</label>
                          <input value={ePhone} onChange={(e) => setEPhone(e.target.value)} className={inputCls} placeholder="0912..." />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Email</label>
                          <input value={eEmail} onChange={(e) => setEEmail(e.target.value)} className={inputCls} placeholder="email@..." />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Người liên hệ</label>
                          <input value={eContactPerson} onChange={(e) => setEContactPerson(e.target.value)} className={inputCls} placeholder="Tên người liên hệ" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Điện thoại 2</label>
                          <input value={ePhone2} onChange={(e) => setEPhone2(e.target.value)} className={inputCls} placeholder="0912..." />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Website</label>
                          <input value={eWebsite} onChange={(e) => setEWebsite(e.target.value)} className={inputCls} placeholder="https://..." />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Zalo</label>
                          <input value={eZalo} onChange={(e) => setEZalo(e.target.value)} className={inputCls} placeholder="Số Zalo hoặc link" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Facebook</label>
                          <input value={eFacebook} onChange={(e) => setEFacebook(e.target.value)} className={inputCls} placeholder="https://facebook.com/..." />
                        </div>
                      </div>

                      <SectionLabel>Địa chỉ</SectionLabel>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Tỉnh / Thành phố</label>
                          <input value={eProvince} onChange={(e) => setEProvince(e.target.value)} className={inputCls} placeholder="Hà Nội..." />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Địa chỉ chi tiết</label>
                          <textarea value={eAddress} onChange={(e) => setEAddress(e.target.value)} rows={2} className={`${inputCls} resize-y`} placeholder="Số nhà, đường..." />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Địa chỉ giao hàng / kho</label>
                          <textarea value={eDeliveryAddress} onChange={(e) => setEDeliveryAddress(e.target.value)} rows={2} className={`${inputCls} resize-y`} placeholder="Địa chỉ kho..." />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Địa chỉ trên hóa đơn VAT</label>
                          <textarea value={eTaxAddress} onChange={(e) => setETaxAddress(e.target.value)} rows={2} className={`${inputCls} resize-y`} placeholder="Địa chỉ HĐ VAT..." />
                        </div>
                      </div>

                      <SectionLabel>Thông tin kinh doanh</SectionLabel>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Nhóm đối tác</label>
                          <input value={eGroup} onChange={(e) => setEGroup(e.target.value)} className={inputCls} placeholder="Nhóm..." />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Nguồn khách</label>
                          <input value={eSource} onChange={(e) => setESource(e.target.value)} className={inputCls} placeholder="Zalo, Facebook..." />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Phân loại</label>
                          <select value={eCustomerType} onChange={(e) => setECustomerType(e.target.value)}
                            className={inputCls}>
                            <option value="">-- Chọn --</option>
                            <option value="individual">Cá nhân</option>
                            <option value="company">Công ty</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Tiền tệ</label>
                          <select value={eCurrency} onChange={(e) => setECurrency(e.target.value)} className={inputCls}>
                            <option value="">VND</option>
                            <option value="USD">USD</option>
                            <option value="CNY">CNY</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Kỳ TT (ngày)</label>
                          <input type="number" value={ePaymentTerm} onChange={(e) => setEPaymentTerm(e.target.value)} className={inputCls} placeholder="30" min="0" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Mã số thuế</label>
                          <input value={eTaxCode} onChange={(e) => setETaxCode(e.target.value)} className={inputCls} placeholder="0100..." />
                        </div>
                      </div>

                      <SectionLabel>Ghi chú</SectionLabel>
                      <textarea value={eNotes} onChange={(e) => setENotes(e.target.value)}
                        rows={3} placeholder="Ghi chú nội bộ..."
                        className={`${inputCls} resize-none`} />

                      <SectionLabel>Ngân hàng</SectionLabel>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Số tài khoản</label>
                          <input value={eBankAccount} onChange={(e) => setEBankAccount(e.target.value)} className={inputCls} placeholder="1234567890" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Ngân hàng</label>
                          <input value={eBankName} onChange={(e) => setEBankName(e.target.value)} className={inputCls} placeholder="MB Bank..." />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Tên chủ tài khoản</label>
                          <input value={eBankHolder} onChange={(e) => setEBankHolder(e.target.value)} className={inputCls} placeholder="NGUYEN VAN A" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Chi nhánh NH</label>
                          <textarea value={eBankBranch} onChange={(e) => setEBankBranch(e.target.value)} rows={2} className={`${inputCls} resize-y`} placeholder="Chi nhánh HN..." />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Tab: Lịch sử đơn ── */}
                  {activeTab === 'history' && (() => {
                    const SALE_STATUS_LABEL: Record<string, string> = {
                      pending: 'Chờ xử lý', processing: 'Đang xử lý',
                      completed: 'Hoàn thành', cancelled: 'Đã hủy',
                    };
                    const PO_STATUS_LABEL: Record<string, string> = {
                      draft: 'Nháp', ordered: 'Đã đặt', received: 'Đã nhận', cancelled: 'Đã hủy',
                    };
                    const STATUS_STYLE: Record<string, string> = {
                      pending: 'bg-yellow-50 text-yellow-600 border-yellow-200',
                      processing: 'bg-blue-50 text-blue-600 border-blue-200',
                      completed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                      draft: 'bg-gray-50 text-gray-500 border-gray-200',
                      ordered: 'bg-blue-50 text-blue-600 border-blue-200',
                      received: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                      cancelled: 'bg-gray-100 text-gray-400 border-gray-200',
                    };
                    const PAY_LABEL: Record<string, string> = { unpaid: 'Chưa TT', partial: 'TT 1 phần', paid: 'Đã TT' };
                    const PAY_STYLE: Record<string, string> = { unpaid: 'text-red-500', partial: 'text-amber-500', paid: 'text-emerald-600' };

                    const isSupplier = partner?.type === 'supplier' || partner?.type === 'freight';
                    const isCustomer = partner?.type === 'customer';
                    const isBoth = partner?.type === 'both';

                    if (ordersLoading) return (
                      <div className="flex items-center justify-center py-10 text-gray-300">
                        <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Đang tải...
                      </div>
                    );

                    const hasNoData = (isCustomer && orders.length === 0) ||
                      (isSupplier && purchaseOrders.length === 0) ||
                      (isBoth && orders.length === 0 && purchaseOrders.length === 0);

                    if (hasNoData) return (
                      <div className="text-center py-10">
                        <svg className="w-10 h-10 mx-auto text-gray-200 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p className="text-gray-300 text-sm">Chưa có đơn hàng nào</p>
                      </div>
                    );

                    return (
                      <div className="space-y-4">
                        {/* Đơn nhập (cho supplier / freight / both) */}
                        {(isSupplier || isBoth) && purchaseOrders.length > 0 && (
                          <div>
                            {isBoth && <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Đơn nhập hàng</p>}
                            <div className="border border-gray-100 rounded-xl overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-violet-50 border-b border-gray-100">
                                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Mã đơn</th>
                                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Ngày</th>
                                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Thanh toán</th>
                                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tổng tiền (VND)</th>
                                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Còn nợ</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {purchaseOrders.map((o) => (
                                    <tr key={o.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition">
                                      <td className="px-4 py-3">
                                        <a href={`/dashboard/don-hang-nhap/nhap-khau/${o.id}`}
                                          className="font-mono text-[11px] bg-violet-50 text-violet-600 hover:bg-violet-100 px-2 py-1 rounded-md tracking-wide transition">
                                          {o.code}
                                        </a>
                                      </td>
                                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-[12px]">
                                        {new Date(o.date).toLocaleDateString('vi-VN')}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLE[o.status] || 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                          {PO_STATUS_LABEL[o.status] || o.status}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={`text-[12px] font-medium ${PAY_STYLE[o.paymentStatus] || 'text-gray-400'}`}>
                                          {PAY_LABEL[o.paymentStatus] || o.paymentStatus}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-right font-semibold text-gray-700 text-[13px]">
                                        {Number(o.totalAmountVnd).toLocaleString('vi-VN')}đ
                                      </td>
                                      <td className="px-4 py-3 text-right text-[13px]">
                                        {Number(o.debtAmountVnd) > 0
                                          ? <span className="font-semibold text-red-500">{Number(o.debtAmountVnd).toLocaleString('vi-VN')}đ</span>
                                          : <span className="text-gray-300">0đ</span>}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {purchaseOrders.length >= 50 && (
                                <div className="px-4 py-2.5 border-t border-gray-50 text-center">
                                  <a href={`/dashboard/don-hang-nhap/nhap-khau?supplierId=${id}`} className="text-xs text-blue-500 hover:underline font-medium">
                                    Xem tất cả đơn nhập →
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Đơn bán (cho customer / both) */}
                        {(isCustomer || isBoth) && orders.length > 0 && (
                          <div>
                            {isBoth && <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Đơn hàng bán</p>}
                            <div className="border border-gray-100 rounded-xl overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-blue-50 border-b border-gray-100">
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
                                        <span className="font-mono text-[11px] bg-gray-50 text-gray-500 px-2 py-1 rounded-md tracking-wide">
                                          {o.code}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-[12px]">
                                        {new Date(o.date).toLocaleDateString('vi-VN')}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLE[o.status] || 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                          {SALE_STATUS_LABEL[o.status] || o.status}
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
                                  <span className="text-xs text-gray-400">Hiển thị 50 đơn gần nhất</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── Tab: Công nợ & Phiếu ── */}
                  {activeTab === 'debt' && (
                    <div>
                      {/* KPI 3 card */}
                      {(partner.type === 'supplier' || partner.type === 'freight') ? (
                        <div className="grid grid-cols-3 gap-3 mb-5">
                          <div className="bg-violet-50 rounded-xl p-3.5">
                            <p className="text-[11px] text-violet-600 font-medium uppercase tracking-wide">Tổng giá trị nhập</p>
                            <p className="text-lg font-bold text-violet-700 mt-0.5">{fmt(psVal('total'))}</p>
                          </div>
                          <div className="bg-emerald-50 rounded-xl p-3.5">
                            <p className="text-[11px] text-emerald-600 font-medium uppercase tracking-wide">Tổng đã thanh toán</p>
                            <p className="text-lg font-bold text-emerald-700 mt-0.5">{fmt(txSummary.totalPayments)}</p>
                          </div>
                          <div className="bg-red-50 rounded-xl p-3.5">
                            <p className="text-[11px] text-red-500 font-medium uppercase tracking-wide">Còn nợ</p>
                            <p className={`text-lg font-bold mt-0.5 ${Number(partner.supplierDebt ?? 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              {fmt(partner.supplierDebt ?? 0)}
                            </p>
                          </div>
                        </div>
                      ) : partner.type === 'customer' ? (
                        <div className="grid grid-cols-3 gap-3 mb-5">
                          <div className="bg-blue-50 rounded-xl p-3.5">
                            <p className="text-[11px] text-blue-600 font-medium uppercase tracking-wide">Tổng doanh thu</p>
                            <p className="text-lg font-bold text-blue-700 mt-0.5">{fmt(partner.totalRevenue)}</p>
                          </div>
                          <div className="bg-emerald-50 rounded-xl p-3.5">
                            <p className="text-[11px] text-emerald-600 font-medium uppercase tracking-wide">Tổng thu</p>
                            <p className="text-lg font-bold text-emerald-700 mt-0.5">{fmt(txSummary.totalReceipts)}</p>
                          </div>
                          <div className="bg-red-50 rounded-xl p-3.5">
                            <p className="text-[11px] text-red-500 font-medium uppercase tracking-wide">Công nợ</p>
                            <p className={`text-lg font-bold mt-0.5 ${Number(partner.totalDebt) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              {fmt(partner.totalDebt)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 mb-5">
                          <div className="bg-red-50 rounded-xl p-3.5">
                            <p className="text-[11px] text-red-500 font-medium uppercase tracking-wide">Tổng chi (NCC)</p>
                            <p className="text-lg font-bold text-red-600 mt-0.5">{fmt(txSummary.totalPayments)}</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-3.5">
                            <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">Mình đang nợ NCC</p>
                            <p className={`text-lg font-bold mt-0.5 ${Number(partner.supplierDebt ?? 0) > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                              {fmt(partner.supplierDebt ?? 0)}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mb-4">
                        {(partner.type === 'customer' || partner.type === 'both') && (
                          <button onClick={() => openVoucher('receipt')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold transition">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                            Tạo phiếu thu
                          </button>
                        )}
                        {(partner.type === 'supplier' || partner.type === 'freight' || partner.type === 'both') && (
                          <button onClick={() => openVoucher('payment')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-semibold transition">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                            </svg>
                            Tạo phiếu chi
                          </button>
                        )}
                      </div>

                      {/* Filter bar */}
                      <div className="flex items-center gap-2 mb-4 flex-wrap">
                        <input
                          type="date" value={txFrom} onChange={(e) => setTxFrom(e.target.value)}
                          className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <span className="text-gray-300 text-sm">—</span>
                        <input
                          type="date" value={txTo} onChange={(e) => setTxTo(e.target.value)}
                          className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <select
                          value={txTypeFilter} onChange={(e) => setTxTypeFilter(e.target.value)}
                          className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                        >
                          <option value="">Tất cả loại</option>
                          <option value="receipt">Phiếu thu</option>
                          <option value="payment">Phiếu chi</option>
                        </select>
                        {(txFrom || txTo || txTypeFilter) && (
                          <button
                            onClick={() => { setTxFrom(''); setTxTo(''); setTxTypeFilter(''); }}
                            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                          >
                            Xóa lọc
                          </button>
                        )}
                        {txLoading && (
                          <svg className="animate-spin w-4 h-4 text-gray-300 ml-1" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                        )}
                      </div>

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
                                      tx.type === 'receipt' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-500 border-red-100'
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
                </div>
              </div>
            </div>

            {/* ── Sidebar (col-span-1) ── */}
            <div className="space-y-3">

              {/* Card 1: Hạng & Giao dịch */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className={`${rankStyle.bg} rounded-lg px-4 py-3 text-center mb-3`}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">HẠNG</p>
                  <p className={`text-2xl font-bold ${rankStyle.text}`}>
                    {partner.rank === 'vip' && '★ '}{RANK_LABEL[partner.rank]}
                  </p>
                </div>
                <div className="space-y-2">
                  {isCustomer && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Tổng đơn bán</span>
                      <span className="font-semibold text-gray-800">{partner.totalOrders || 0}</span>
                    </div>
                  )}
                  {isSupplier && !isCustomer && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Số đơn nhập</span>
                      <span className="font-semibold text-gray-800">{psVal('orders')}</span>
                    </div>
                  )}
                  {partner.type === 'both' && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Đơn bán / Đơn nhập</span>
                      <span className="font-semibold text-gray-800">{partner.totalOrders || 0} / {psVal('orders')}</span>
                    </div>
                  )}
                  {isCustomer && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Doanh thu</span>
                      <span className="font-semibold text-emerald-600">{fmt(partner.totalRevenue)}</span>
                    </div>
                  )}
                  {isSupplier && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Tổng nhập hàng</span>
                      <span className="font-semibold text-violet-600">{fmt(psVal('total'))}</span>
                    </div>
                  )}
                  {partner.rating != null && partner.rating > 0 && (
                    <div className="flex justify-between items-center text-sm pt-1.5 border-t border-gray-50">
                      <span className="text-gray-500">Đánh giá</span>
                      <span className="text-amber-400 text-sm">{'★'.repeat(partner.rating)}{'☆'.repeat(5 - partner.rating)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Tài chính */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Tài chính</p>
                <div className="space-y-2.5">
                  {isCustomer && (
                    <>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">KH đang nợ</span>
                        <span className={`font-semibold ${Number(partner.totalDebt) > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          {fmt(partner.totalDebt)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Hạn mức CN</span>
                        <span className="font-semibold text-gray-700">{fmt(partner.creditLimit)}</span>
                      </div>
                      {Number(partner.creditLimit) > 0 && (
                        <div>
                          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
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
                  {isSupplier && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Mình đang nợ</span>
                      <span className={`font-semibold ${Number(partner.supplierDebt) > 0 ? 'text-violet-600' : 'text-gray-400'}`}>
                        {fmt(partner.supplierDebt)}
                      </span>
                    </div>
                  )}
                  {partner.paymentTerm ? (
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-50">
                      <span className="text-gray-500">Kỳ thanh toán</span>
                      <span className="font-semibold text-gray-700">{partner.paymentTerm} ngày</span>
                    </div>
                  ) : null}
                  {partner.currency && partner.currency !== 'VND' && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Tiền tệ</span>
                      <span className="font-semibold text-violet-600">{partner.currency}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 3: Thống kê nhập hàng (NCC only) */}
              {(partner.type === 'supplier' || partner.type === 'both' || partner.type === 'freight') && purchaseStats && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Thống kê nhập</p>
                    <a href={`/dashboard/don-hang-nhap/nhap-khau?supplierId=${partner.id}`}
                      className="text-[10px] text-blue-500 hover:text-blue-700 font-medium transition">Xem đơn →</a>
                  </div>
                  <div className="flex gap-1 mb-3 bg-gray-50 p-0.5 rounded-lg">
                    {(['all','1m','3m','6m','1y'] as const).map((p) => (
                      <button key={p} onClick={() => setPurchasePeriod(p)}
                        className={`flex-1 px-1 py-1 text-[10px] font-semibold rounded transition ${purchasePeriod === p ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                        {p === 'all' ? 'Tất cả' : p}
                      </button>
                    ))}
                  </div>
                  <div className="bg-violet-50 rounded-lg px-3 py-2.5 mb-2">
                    <p className="text-[10px] text-violet-500 font-medium uppercase tracking-wide mb-0.5">Giá trị nhập</p>
                    <p className="text-base font-bold text-violet-700">{fmt(psVal('total'))}</p>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Số đơn nhập</span>
                    <span className="font-semibold text-gray-700">{psVal('orders')}</span>
                  </div>
                </div>
              )}

              {/* Card 4: Thông tin nhanh */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Thông tin nhanh</p>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-gray-400">Mã</span>
                    <span className="font-mono text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{partner.code}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-gray-400">Loại</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${TYPE_STYLE[partner.type] || 'bg-gray-100 text-gray-500'}`}>
                      {TYPE_LABEL[partner.type] || partner.type}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-gray-400">Trạng thái</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${partner.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                      {partner.isActive ? 'Hoạt động' : 'Đã ngừng'}
                    </span>
                  </div>
                </div>

                {partner.assignedStaff && (
                  <>
                    <div className="flex items-center gap-2 mt-3 mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">NV phụ trách</span>
                      <div className="flex-1 border-t border-gray-100" />
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-600 font-bold text-xs">{partner.assignedStaff.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700 leading-tight">{partner.assignedStaff.name}</p>
                        {partner.assignedStaff.email && <p className="text-[10px] text-gray-400">{partner.assignedStaff.email}</p>}
                      </div>
                    </div>
                  </>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
