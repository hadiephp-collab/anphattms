'use client';
// Trang danh sách Đơn Hàng — KPI theo kỳ, tabs, bộ lọc, chọn cột, sort, phân trang, xuất file

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ordersApi } from '@/lib/orders';
import { employeesApi } from '@/lib/employees';
import { localDateStr } from '@/lib/utils';

interface Order {
  id: number; code: string; date: string; deliveryDate?: string;
  customer?: { id: number; name: string; phone?: string };
  assignedTo?: { id: number; fullName: string };
  orderType?: string;
  subtotal: number; discountAmount: number; shippingFee: number;
  totalAmount: number; paidAmount: number; debtAmount: number;
  status: string; invoiceStatus: string; paymentStatus: string;
  shippingMethod?: string; shippingAddress?: string;
  source?: string; tags?: string; reference?: string;
  cancelReason?: string; notes?: string;
  items?: { id: number }[];
}
interface Stats {
  totalOrders: number; revenue: number; collected: number;
  debt: number; cancelled: number; cancelledTotal: number; pendingInvoice: number; hasDebtCount: number;
  byStatus: {
    pending:    { count: number; total: number };
    processing: { count: number; total: number };
    completed:  { count: number; total: number };
    cancelled:  { count: number; total: number };
  };
  pendingInvoiceBreakdown: { count: number; total: number };
}
interface Employee { id: number; fullName: string; code: string; }

// ─── Cột có thể bật/tắt ──────────────────────────────────────────────────────
const COL_GROUPS = [
  { group: 'Đơn hàng', cols: [
    { key: 'code',           label: 'Mã đơn',           required: true },
    { key: 'items_count',    label: 'Số sản phẩm' },
    { key: 'orderType',      label: 'Loại đơn' },
    { key: 'source',         label: 'Nguồn bán' },
    { key: 'reference',      label: 'Tham chiếu' },
  ]},
  { group: 'Khách hàng', cols: [
    { key: 'customer',       label: 'Tên khách hàng',   required: true },
    { key: 'customer_phone', label: 'SĐT khách hàng' },
  ]},
  { group: 'Thanh toán', cols: [
    { key: 'subtotal',       label: 'Tổng hàng' },
    { key: 'discountAmount', label: 'Chiết khấu' },
    { key: 'shippingFee',    label: 'Phí vận chuyển' },
    { key: 'totalAmount',    label: 'Tổng tiền' },
    { key: 'paidAmount',     label: 'Đã thu' },
    { key: 'debtAmount',     label: 'Còn nợ' },
    { key: 'paymentStatus',  label: 'Trạng thái TT' },
  ]},
  { group: 'Trạng thái', cols: [
    { key: 'status',         label: 'Trạng thái đơn' },
    { key: 'invoiceStatus',  label: 'Xuất hóa đơn' },
  ]},
  { group: 'Thời gian', cols: [
    { key: 'date',           label: 'Ngày tạo' },
    { key: 'deliveryDate',   label: 'Ngày giao' },
  ]},
  { group: 'Vận chuyển', cols: [
    { key: 'shippingMethod',  label: 'Phương thức VC' },
    { key: 'shippingAddress', label: 'Địa chỉ giao' },
  ]},
  { group: 'Nhân viên & Ghi chú', cols: [
    { key: 'assignedTo',    label: 'NV phụ trách' },
    { key: 'tags',          label: 'Tags' },
    { key: 'cancelReason',  label: 'Lý do hủy' },
    { key: 'notes',         label: 'Ghi chú' },
  ]},
];
const ALL_COLS = COL_GROUPS.flatMap(g => g.cols);
const DEFAULT_COLS = new Set(['code', 'customer', 'items_count', 'totalAmount', 'debtAmount', 'status', 'paymentStatus', 'invoiceStatus', 'date']);
const REQUIRED_COLS = new Set(['code', 'customer']);

function loadCols(): Set<string> {
  try {
    const s = localStorage.getItem('orders_cols');
    if (s) {
      const saved = new Set<string>(JSON.parse(s));
      REQUIRED_COLS.forEach(k => saved.add(k));
      return saved;
    }
  } catch {}
  return new Set(DEFAULT_COLS);
}

// ─── Kỳ thống kê ────────────────────────────────────────────────────────────
const PERIODS = [
  { key: '7',   label: '7 ngày gần nhất' },
  { key: '30',  label: '30 ngày gần nhất' },
  { key: '90',  label: '90 ngày gần nhất' },
  { key: '180', label: '6 tháng gần nhất' },
  { key: '365', label: '12 tháng gần nhất' },
  { key: 'all', label: 'Toàn thời gian' },
];

function getPeriodDates(key: string): { dateFrom?: string; dateTo?: string } {
  if (key === 'all') return {};
  const days = parseInt(key);
  const to   = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days + 1);
  return {
    dateFrom: localDateStr(from),
    dateTo:   localDateStr(to),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt  = (n?: number) => n != null ? Number(n).toLocaleString('vi-VN') + 'đ' : '0đ';
const fmtM = (n?: number) => n != null ? Number(n).toLocaleString('vi-VN') + 'đ' : '0đ';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xử lý', processing: 'Đang xử lý', completed: 'Hoàn thành', cancelled: 'Đã hủy',
};
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
};
const INV_LABEL: Record<string, string> = {
  pending_invoice: 'Chờ HĐ', invoiced: 'Đã HĐ', no_invoice: 'Không HĐ',
};
const INV_COLOR: Record<string, string> = {
  pending_invoice: 'bg-orange-100 text-orange-600',
  invoiced: 'bg-green-100 text-green-700',
  no_invoice: 'bg-gray-100 text-gray-500',
};
const PAY_LABEL: Record<string, string> = {
  unpaid: 'Chưa thu', partial: 'Thu một phần', paid: 'Đã thanh toán',
};
const PAY_COLOR: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-600',
  partial: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
};
const SHIP_LABEL: Record<string, string> = { delivery: 'Giao hàng', pickup: 'Tự lấy' };
const ORDER_TYPE_LABEL: Record<string, string> = { normal: 'Thường', deposit: 'Đặt cọc' };

type TabKey = 'all' | 'needs_action' | 'has_debt';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',          label: 'Tất cả' },
  { key: 'needs_action', label: 'Cần xử lý' },
  { key: 'has_debt',     label: 'Còn nợ' },
];

function SortIcon({ col, sortBy, sortOrder }: { col: string; sortBy: string; sortOrder: 'ASC' | 'DESC' }) {
  const active = sortBy === col;
  return (
    <span className="inline-flex flex-col ml-1 opacity-60">
      <svg className={`w-2.5 h-2.5 -mb-0.5 ${active && sortOrder === 'ASC' ? 'opacity-100 text-blue-600' : 'opacity-30'}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 0L10 6H0z" /></svg>
      <svg className={`w-2.5 h-2.5 ${active && sortOrder === 'DESC' ? 'opacity-100 text-blue-600' : 'opacity-30'}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 6L0 0H10z" /></svg>
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const [orders, setOrders]   = useState<Order[]>([]);
  const [stats, setStats]     = useState<Stats | null>(null);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit]     = useState<20 | 50 | 100>(20);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab]     = useState<TabKey>('all');
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus]               = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [filterInvoiceStatus, setFilterInvoiceStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom]       = useState('');
  const [filterDateTo, setFilterDateTo]           = useState('');
  const [filterAssignedTo, setFilterAssignedTo]   = useState('');
  const [filterTag, setFilterTag]     = useState('');
  const [showFilter, setShowFilter]   = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected]       = useState<Set<number>>(new Set());

  const [sortBy, setSortBy]       = useState('date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  const [visibleCols, setVisibleCols]         = useState<Set<string>>(DEFAULT_COLS);
  const [showColSettings, setShowColSettings] = useState(false);
  // Kỳ thống kê KPI
  const [statsPeriod, setStatsPeriod] = useState('30');
  const [showPeriodDrop, setShowPeriodDrop] = useState(false);
  const periodRef = useRef<HTMLDivElement>(null);

  const [exporting, setExporting] = useState(false);

  useEffect(() => { setVisibleCols(loadCols()); }, []);
  useEffect(() => {
    employeesApi.getAll({ limit: '200', isActive: 'true' }).then((r: any) => setEmployees(r.items ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) setShowPeriodDrop(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function saveColSettings(cols: Set<string>) {
    setVisibleCols(cols);
    localStorage.setItem('orders_cols', JSON.stringify([...cols]));
    setShowColSettings(false);
  }

  function toggleSort(col: string) {
    if (sortBy === col) setSortOrder(o => o === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(col); setSortOrder('DESC'); }
    setPage(1);
  }

  const buildParams = useCallback(() => {
    const p: Record<string, string> = { page: String(page), limit: String(limit), sortBy, sortOrder };
    if (search)               p.search        = search;
    if (filterStatus)         p.status        = filterStatus;
    if (filterPaymentStatus)  p.paymentStatus = filterPaymentStatus;
    if (filterAssignedTo)     p.assignedToId  = filterAssignedTo;
    if (filterTag)            p.tags          = filterTag;
    if (filterDateFrom)       p.dateFrom      = filterDateFrom;
    if (filterDateTo)         p.dateTo        = filterDateTo;
    if (activeTab === 'needs_action')    p.needsAction   = 'true';
    if (activeTab === 'has_debt')        p.hasDebt       = 'true';
    if (filterInvoiceStatus)             p.invoiceStatus = filterInvoiceStatus;
    return p;
  }, [page, limit, search, filterStatus, filterPaymentStatus, filterInvoiceStatus, filterAssignedTo, filterTag, filterDateFrom, filterDateTo, activeTab, sortBy, sortOrder]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const periodDates = getPeriodDates(statsPeriod);
      const [res, s] = await Promise.all([
        ordersApi.getAll(buildParams()),
        ordersApi.getStats(periodDates.dateFrom || periodDates.dateTo ? periodDates as Record<string,string> : undefined),
      ]);
      setOrders(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setStats(s);
    } catch {}
    setLoading(false);
  }, [buildParams, statsPeriod]);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(id: number, status: string) {
    try { await ordersApi.updateStatus(id, status); load(); }
    catch (e: any) { alert(e.message); }
  }

  // ─── Export CSV ─────────────────────────────────────────────────────────────
  async function handleExport() {
    setExporting(true);
    try {
      const res = await ordersApi.getAll({ ...buildParams(), page: '1', limit: '9999' });
      const headers = ['Mã đơn', 'Khách hàng', 'SĐT khách', 'Số SP', 'Tổng tiền', 'Đã thu', 'Còn nợ', 'Trạng thái', 'Thanh toán', 'Xuất HĐ', 'Ngày tạo', 'Ghi chú'];
      const rows = (res.data as Order[]).map(o => [
        o.code,
        o.customer?.name ?? 'Khách lẻ',
        o.customer?.phone ?? '',
        o.items?.length ?? 0,
        o.totalAmount,
        o.paidAmount,
        o.debtAmount,
        STATUS_LABEL[o.status] ?? o.status,
        PAY_LABEL[o.paymentStatus] ?? o.paymentStatus,
        INV_LABEL[o.invoiceStatus] ?? o.invoiceStatus,
        o.date ? new Date(o.date).toLocaleDateString('vi-VN') : '',
        o.notes ?? '',
      ]);
      const csv = [headers, ...rows]
        .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `don-hang-${localDateStr()}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch {}
    setExporting(false);
  }

  const chips: { label: string; clear: () => void }[] = [];
  if (filterStatus)        chips.push({ label: STATUS_LABEL[filterStatus] ?? filterStatus,   clear: () => setFilterStatus('') });
  if (filterPaymentStatus) chips.push({ label: PAY_LABEL[filterPaymentStatus] ?? filterPaymentStatus, clear: () => setFilterPaymentStatus('') });
  if (filterInvoiceStatus) chips.push({ label: INV_LABEL[filterInvoiceStatus] ?? filterInvoiceStatus, clear: () => setFilterInvoiceStatus('') });
  if (filterAssignedTo)    chips.push({ label: `NV: ${employees.find(e => String(e.id) === filterAssignedTo)?.fullName ?? filterAssignedTo}`, clear: () => setFilterAssignedTo('') });
  if (filterTag)           chips.push({ label: `Tag: ${filterTag}`, clear: () => setFilterTag('') });
  if (filterDateFrom)      chips.push({ label: `Từ ${filterDateFrom}`, clear: () => setFilterDateFrom('') });
  if (filterDateTo)        chips.push({ label: `Đến ${filterDateTo}`,  clear: () => setFilterDateTo('') });

  const toggleSelect = (id: number) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll = () =>
    setSelected(prev => prev.size === orders.length ? new Set() : new Set(orders.map(o => o.id)));

  async function bulkUpdate(status: string) {
    if (selected.size === 0) return;
    try { await ordersApi.bulkUpdateStatus(Array.from(selected), status); setSelected(new Set()); load(); }
    catch (e: any) { alert(e.message); }
  }

  const has = (col: string) => visibleCols.has(col);
  const pageFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageTo   = Math.min(page * limit, total);
  const currentPeriodLabel = PERIODS.find(p => p.key === statsPeriod)?.label ?? '30 ngày';

  return (
    <div className="p-6 min-h-screen">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Đơn Hàng</h1>
        <div className="flex items-center gap-2">
          {/* Xuất file */}
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 disabled:opacity-50 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Đang xuất...' : 'Xuất file'}
          </button>
          <Link href="/dashboard/orders/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition shadow-sm">
            <span className="text-lg leading-none">+</span> Tạo đơn hàng
          </Link>
        </div>
      </div>

      {/* ── KPI Bar + Chọn kỳ ── */}
      <div className="mb-5">
        {/* Chọn kỳ thống kê */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Thống kê đơn hàng</p>
          <div ref={periodRef} className="relative">
            <button onClick={() => setShowPeriodDrop(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 bg-blue-50 px-2.5 py-1 rounded-lg transition">
              {currentPeriodLabel}
              <svg className={`w-3 h-3 transition-transform ${showPeriodDrop ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showPeriodDrop && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                {PERIODS.map(p => (
                  <button key={p.key} onClick={() => { setStatsPeriod(p.key); setShowPeriodDrop(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition ${statsPeriod === p.key ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* KPI — hàng 1: tổng quan */}
        {stats && (
          <>
          <div className="grid grid-cols-4 gap-3 mb-3">
            {([
              { label: 'Tổng đơn',  value: stats.totalOrders.toLocaleString(), sub: 'Xem tất cả',                      gradient: 'from-slate-600 to-slate-800', shadow: 'shadow-slate-200',
                onClick: () => { setActiveTab('all'); setFilterStatus(''); setFilterPaymentStatus(''); setFilterAssignedTo(''); setPage(1); },
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /> },
              { label: 'Doanh thu', value: fmtM(stats.revenue),   sub: `${stats.totalOrders} đơn`,                     gradient: 'from-blue-500 to-blue-700',   shadow: 'shadow-blue-200',
                onClick: null as (() => void) | null,
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> },
              { label: 'Đã thu',    value: fmtM(stats.collected), sub: `Lọc đơn đã thanh toán`,                        gradient: 'from-emerald-500 to-emerald-700', shadow: 'shadow-emerald-200',
                onClick: () => { setFilterPaymentStatus('paid'); setPage(1); },
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> },
              { label: 'Còn nợ',   value: fmtM(stats.debt),      sub: `${stats.hasDebtCount} đơn chưa thu đủ`,        gradient: 'from-red-500 to-red-700',     shadow: 'shadow-red-200',
                onClick: () => { setActiveTab('has_debt'); setPage(1); },
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
            ] as const).map(k => {
              const Tag = k.onClick ? 'button' : 'div';
              return (
              <Tag key={k.label} onClick={k.onClick ?? undefined}
                className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${k.gradient} shadow-sm ${k.shadow} flex items-center gap-3 px-4 py-3.5 w-full text-left ${k.onClick ? 'cursor-pointer hover:brightness-110 active:scale-[0.98] transition' : ''}`}>
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                  <svg className="w-[18px] h-[18px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">{k.icon}</svg>
                </div>
                <div className="z-10 min-w-0">
                  <p className="text-[11px] text-white/60 font-medium leading-none">{k.label}</p>
                  <p className="text-base font-bold text-white mt-0.5 leading-tight truncate">{k.value}</p>
                  {k.sub && <p className={`text-[10px] mt-0.5 leading-none ${k.onClick ? 'text-white/70 underline underline-offset-2' : 'text-white/50'}`}>{k.sub}</p>}
                </div>
                <div className="absolute -right-3 -bottom-3 w-14 h-14 rounded-full bg-white/10" />
              </Tag>
            )})}
          </div>

          {/* KPI — hàng 2: breakdown theo trạng thái (click để lọc) */}
          <div className="grid grid-cols-4 gap-2">
            {([
              { key: 'pending',         label: 'Chờ xử lý',   count: stats.byStatus.pending.count,          total: stats.byStatus.pending.total,               bg: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-400', onClick: () => { setFilterStatus('pending');    setPage(1); } },
              { key: 'processing',      label: 'Đang xử lý',  count: stats.byStatus.processing.count,       total: stats.byStatus.processing.total,            bg: 'bg-blue-50 border-blue-200',     dot: 'bg-blue-400',   onClick: () => { setFilterStatus('processing'); setPage(1); } },
              { key: 'completed',       label: 'Hoàn thành',  count: stats.byStatus.completed.count,        total: stats.byStatus.completed.total,             bg: 'bg-green-50 border-green-200',   dot: 'bg-green-400',  onClick: () => { setFilterStatus('completed');  setPage(1); } },
              { key: 'cancelled',       label: 'Đã hủy',      count: stats.byStatus.cancelled.count,        total: stats.cancelledTotal,                       bg: 'bg-gray-50 border-gray-200',     dot: 'bg-gray-400',   onClick: () => { setFilterStatus('cancelled');  setPage(1); } },
            ] as const).map(k => (
              <button key={k.key} onClick={k.onClick}
                className={`${k.bg} border rounded-xl px-3 py-3 text-left hover:shadow-md transition-shadow w-full`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${k.dot}`} />
                  <span className="text-[11px] font-semibold text-gray-600 truncate">{k.label}</span>
                </div>
                <p className="text-lg font-bold text-gray-800 leading-none">{k.count.toLocaleString()}<span className="text-xs font-normal text-gray-400 ml-1">đơn</span></p>
                <p className="text-[11px] text-gray-500 mt-0.5 truncate font-medium">{fmtM(k.total)}</p>
              </button>
            ))}
          </div>
          </>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setActiveTab(t.key); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium transition rounded-t-lg border-b-2 ${
              activeTab === t.key ? 'text-blue-600 border-blue-500 bg-blue-50' : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Toolbar: gear trái, search, filter, chips, bulk ── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">

        {/* Gear — chọn cột (mở modal) */}
        <button onClick={() => setShowColSettings(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Chọn cột
          <span className="text-[11px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded-full">{visibleCols.size}</span>
        </button>

        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Tìm mã đơn, tên khách..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white" />
        </div>

        {/* Bộ lọc */}
        <button onClick={() => setShowFilter(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl bg-white hover:bg-gray-50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          Bộ lọc {chips.length > 0 && <span className="w-4 h-4 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center">{chips.length}</span>}
        </button>

        {/* Filter chips */}
        {chips.map(chip => (
          <span key={chip.label} className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200">
            {chip.label}
            <button onClick={chip.clear} className="ml-0.5 hover:text-blue-900">×</button>
          </span>
        ))}

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-1.5 ml-auto bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 flex-wrap">
            <span className="text-xs text-blue-700 font-semibold mr-1">Đã chọn {selected.size}</span>
            <div className="w-px h-4 bg-blue-200 mx-0.5" />
            {/* Trạng thái đơn */}
            <button onClick={() => bulkUpdate('processing')}
              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition font-medium">
              Đang xử lý
            </button>
            <button onClick={() => bulkUpdate('completed')}
              className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition font-medium">
              Hoàn thành
            </button>
            <div className="w-px h-4 bg-blue-200 mx-0.5" />
            {/* Hủy + bỏ chọn */}
            <button onClick={() => bulkUpdate('cancelled')}
              className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition font-medium">
              Hủy đơn
            </button>
            <button onClick={() => setSelected(new Set())}
              className="text-xs px-2 py-1 text-blue-400 hover:text-blue-600 transition ml-0.5">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Filter panel */}
      {showFilter && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 shadow-sm">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nhân viên phụ trách</label>
            <select value={filterAssignedTo} onChange={e => { setFilterAssignedTo(e.target.value); setPage(1); }}
              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none">
              <option value="">Tất cả nhân viên</option>
              {employees.map(e => <option key={e.id} value={String(e.id)}>{e.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Trạng thái đơn</label>
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none">
              <option value="">Tất cả</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Thanh toán</label>
            <select value={filterPaymentStatus} onChange={e => { setFilterPaymentStatus(e.target.value); setPage(1); }}
              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none">
              <option value="">Tất cả</option>
              {Object.entries(PAY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Xuất HĐ</label>
            <select value={filterInvoiceStatus} onChange={e => { setFilterInvoiceStatus(e.target.value); setPage(1); }}
              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none">
              <option value="">Tất cả</option>
              {Object.entries(INV_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Từ ngày</label>
            <input type="date" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setPage(1); }}
              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Đến ngày</label>
            <input type="date" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setPage(1); }}
              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tag</label>
            <input value={filterTag} onChange={e => { setFilterTag(e.target.value); setPage(1); }}
              placeholder="vip, gấp..."
              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none" />
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Đang tải...</div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">Không có đơn hàng nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-100 text-xs text-gray-600">
                <th className="px-4 py-3 text-left w-8 sticky left-0 bg-gray-100 z-10">
                  <input type="checkbox" checked={selected.size === orders.length && orders.length > 0} onChange={toggleAll} className="rounded" />
                </th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap min-w-[140px] sticky left-8 bg-gray-100 z-10">
                  <button onClick={() => toggleSort('code')} className="flex items-center">Mã đơn <SortIcon col="code" sortBy={sortBy} sortOrder={sortOrder} /></button>
                </th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap min-w-[170px]">Khách hàng</th>
                {has('customer_phone')  && <th className="px-4 py-3 text-left font-semibold whitespace-nowrap min-w-[130px]">SĐT KH</th>}
                {has('items_count')     && <th className="px-4 py-3 text-center font-semibold whitespace-nowrap min-w-[80px]">Số SP</th>}
                {has('orderType')       && <th className="px-4 py-3 text-center font-semibold whitespace-nowrap min-w-[100px]">Loại đơn</th>}
                {has('source')          && <th className="px-4 py-3 text-left font-semibold whitespace-nowrap min-w-[110px]">Nguồn bán</th>}
                {has('reference')       && <th className="px-4 py-3 text-left font-semibold whitespace-nowrap min-w-[120px]">Tham chiếu</th>}
                {has('subtotal')        && <th className="px-4 py-3 text-right font-semibold whitespace-nowrap min-w-[120px]">Tổng hàng</th>}
                {has('discountAmount')  && <th className="px-4 py-3 text-right font-semibold whitespace-nowrap min-w-[110px]">Chiết khấu</th>}
                {has('shippingFee')     && <th className="px-4 py-3 text-right font-semibold whitespace-nowrap min-w-[110px]">Phí VC</th>}
                {has('totalAmount')     && <th className="px-4 py-3 text-right font-semibold whitespace-nowrap min-w-[120px]"><button onClick={() => toggleSort('totalAmount')} className="flex items-center ml-auto">Tổng tiền <SortIcon col="totalAmount" sortBy={sortBy} sortOrder={sortOrder} /></button></th>}
                {has('paidAmount')      && <th className="px-4 py-3 text-right font-semibold whitespace-nowrap min-w-[110px]">Đã thu</th>}
                {has('debtAmount')      && <th className="px-4 py-3 text-right font-semibold whitespace-nowrap min-w-[110px]"><button onClick={() => toggleSort('debtAmount')} className="flex items-center ml-auto">Còn nợ <SortIcon col="debtAmount" sortBy={sortBy} sortOrder={sortOrder} /></button></th>}
                {has('paymentStatus')   && <th className="px-4 py-3 text-center font-semibold whitespace-nowrap min-w-[120px]">Thanh toán</th>}
                {has('status')          && <th className="px-4 py-3 text-center font-semibold whitespace-nowrap min-w-[120px]">Trạng thái</th>}
                {has('invoiceStatus')   && <th className="px-4 py-3 text-center font-semibold whitespace-nowrap min-w-[110px]">Xuất HĐ</th>}
                {has('date')            && <th className="px-4 py-3 text-left font-semibold whitespace-nowrap min-w-[100px]"><button onClick={() => toggleSort('date')} className="flex items-center">Ngày tạo <SortIcon col="date" sortBy={sortBy} sortOrder={sortOrder} /></button></th>}
                {has('deliveryDate')    && <th className="px-4 py-3 text-left font-semibold whitespace-nowrap min-w-[100px]">Ngày giao</th>}
                {has('shippingMethod')  && <th className="px-4 py-3 text-center font-semibold whitespace-nowrap min-w-[110px]">Vận chuyển</th>}
                {has('shippingAddress') && <th className="px-4 py-3 text-left font-semibold whitespace-nowrap min-w-[180px]">Địa chỉ giao</th>}
                {has('assignedTo')      && <th className="px-4 py-3 text-left font-semibold whitespace-nowrap min-w-[130px]">NV phụ trách</th>}
                {has('tags')            && <th className="px-4 py-3 text-left font-semibold whitespace-nowrap min-w-[120px]">Tags</th>}
                {has('cancelReason')    && <th className="px-4 py-3 text-left font-semibold whitespace-nowrap min-w-[160px]">Lý do hủy</th>}
                {has('notes')           && <th className="px-4 py-3 text-left font-semibold whitespace-nowrap min-w-[160px]">Ghi chú</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-4 py-3 sticky left-0 bg-white z-10">
                    <input type="checkbox" checked={selected.has(order.id)} onChange={() => toggleSelect(order.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-3 sticky left-8 bg-white z-10">
                    <Link href={`/dashboard/orders/${order.id}`} className="font-semibold text-blue-600 hover:underline font-mono text-xs">
                      {order.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {order.customer?.name ?? <span className="text-gray-400 italic">Khách lẻ</span>}
                  </td>
                  {has('customer_phone')  && <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{order.customer?.phone || <span className="text-gray-300">—</span>}</td>}
                  {has('items_count')     && <td className="px-4 py-3 text-center text-gray-500 text-xs whitespace-nowrap">{order.items?.length ?? 0} SP</td>}
                  {has('orderType')       && <td className="px-4 py-3 text-center text-xs whitespace-nowrap"><span className={`px-2 py-0.5 rounded-full ${order.orderType === 'deposit' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>{ORDER_TYPE_LABEL[order.orderType ?? 'normal'] ?? '—'}</span></td>}
                  {has('source')          && <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{order.source || <span className="text-gray-300">—</span>}</td>}
                  {has('reference')       && <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{order.reference || <span className="text-gray-300">—</span>}</td>}
                  {has('subtotal')        && <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{fmt(order.subtotal)}</td>}
                  {has('discountAmount')  && <td className="px-4 py-3 text-right whitespace-nowrap">{Number(order.discountAmount) > 0 ? <span className="text-orange-600">-{fmt(order.discountAmount)}</span> : <span className="text-gray-300">—</span>}</td>}
                  {has('shippingFee')     && <td className="px-4 py-3 text-right whitespace-nowrap">{Number(order.shippingFee) > 0 ? fmt(order.shippingFee) : <span className="text-gray-300">—</span>}</td>}
                  {has('totalAmount')     && <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">{fmt(order.totalAmount)}</td>}
                  {has('paidAmount')      && <td className="px-4 py-3 text-right whitespace-nowrap"><span className="text-green-700">{fmt(order.paidAmount)}</span></td>}
                  {has('debtAmount')      && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {Number(order.debtAmount) > 0
                        ? <span className="text-red-600 font-semibold">{fmt(order.debtAmount)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  {has('paymentStatus')   && (
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PAY_COLOR[order.paymentStatus] ?? ''}`}>
                        {PAY_LABEL[order.paymentStatus] ?? order.paymentStatus}
                      </span>
                    </td>
                  )}
                  {has('status')          && (
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <select value={order.status} onChange={e => changeStatus(order.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none ${STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                  )}
                  {has('invoiceStatus')   && (
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${INV_COLOR[order.invoiceStatus] ?? ''}`}>
                        {INV_LABEL[order.invoiceStatus] ?? order.invoiceStatus}
                      </span>
                    </td>
                  )}
                  {has('date')            && <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{order.date ? new Date(order.date).toLocaleDateString('vi-VN') : '—'}</td>}
                  {has('deliveryDate')    && <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('vi-VN') : <span className="text-gray-300">—</span>}</td>}
                  {has('shippingMethod')  && <td className="px-4 py-3 text-center text-xs text-gray-500 whitespace-nowrap">{SHIP_LABEL[order.shippingMethod ?? ''] ?? '—'}</td>}
                  {has('shippingAddress') && <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px] truncate">{order.shippingAddress || <span className="text-gray-300">—</span>}</td>}
                  {has('assignedTo')      && (
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {order.assignedTo ? order.assignedTo.fullName : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  {has('tags')            && <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{order.tags || <span className="text-gray-300">—</span>}</td>}
                  {has('cancelReason')    && <td className="px-4 py-3 text-xs text-gray-400 max-w-[160px] truncate">{order.cancelReason || <span className="text-gray-300">—</span>}</td>}
                  {has('notes')           && <td className="px-4 py-3 text-xs text-gray-400 max-w-[160px] truncate">{order.notes || <span className="text-gray-300">—</span>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}

        {/* ── Pagination ── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>Hiển thị</span>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              {([20, 50, 100] as const).map(n => (
                <button key={n} onClick={() => { setLimit(n); setPage(1); }}
                  className={`px-2.5 py-1 text-xs font-medium transition border-r border-gray-200 last:border-r-0 ${limit === n ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                  {n}
                </button>
              ))}
            </div>
            <span>kết quả</span>
          </div>
          <span className="text-gray-200">·</span>
          <span className="text-xs text-gray-400">
            {total === 0 ? '0' : `${pageFrom}–${pageTo}`} trên tổng <span className="font-semibold text-gray-600">{total}</span> đơn
          </span>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs font-medium"
              title="Trang đầu">«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs"
              title="Trang trước">‹</button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === 'ellipsis'
                  ? <span key={`e${idx}`} className="w-7 h-7 flex items-center justify-center text-gray-300 text-xs">…</span>
                  : <button key={item} onClick={() => setPage(item as number)}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition ${page === item ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>
                      {item}
                    </button>
              )}

            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs"
              title="Trang sau">›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs font-medium"
              title="Trang cuối">»</button>
          </div>
        )}
        </div>{/* end pagination */}
      </div>{/* end table card */}
      {/* ── Modal: Tùy chỉnh cột ── */}
      {showColSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowColSettings(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-800">Tùy chỉnh cột hiển thị</h3>
                <p className="text-xs text-gray-400 mt-0.5">Đang hiển thị {visibleCols.size} cột • Chọn tối đa tất cả các cột cần thiết</p>
              </div>
              <button onClick={() => setShowColSettings(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Body: 2 panels */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left: grouped columns */}
              <div className="w-1/2 border-r border-gray-100 overflow-y-auto p-4 space-y-5">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tất cả các cột</p>
                {COL_GROUPS.map(g => (
                  <div key={g.group}>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">{g.group}</p>
                    <div className="space-y-1">
                      {g.cols.map(col => {
                        const checked  = visibleCols.has(col.key);
                        const disabled = REQUIRED_COLS.has(col.key);
                        return (
                          <label key={col.key} className={`flex items-center gap-2.5 text-sm py-1.5 px-2 rounded-lg cursor-pointer transition ${
                            disabled ? 'opacity-50 cursor-not-allowed' :
                            checked  ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' :
                                       'text-gray-700 hover:bg-gray-50'
                          }`}>
                            <input type="checkbox" checked={checked} disabled={disabled}
                              onChange={e => {
                                const next = new Set(visibleCols);
                                e.target.checked ? next.add(col.key) : next.delete(col.key);
                                saveColSettings(next);
                              }}
                              className="w-3.5 h-3.5 rounded accent-blue-600 flex-shrink-0" />
                            <span className="flex-1">{col.label}</span>
                            {disabled && <span className="text-[10px] text-gray-400">Bắt buộc</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {/* Right: selected columns */}
              <div className="w-1/2 overflow-y-auto p-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Đang hiển thị ({visibleCols.size} cột)</p>
                <div className="space-y-1">
                  {ALL_COLS.filter(c => visibleCols.has(c.key)).map(col => {
                    const disabled = REQUIRED_COLS.has(col.key);
                    return (
                      <div key={col.key} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                        <span className="text-gray-700">{col.label}</span>
                        {disabled
                          ? <span className="text-[10px] text-gray-400">Bắt buộc</span>
                          : (
                            <button onClick={() => {
                              const next = new Set(visibleCols);
                              next.delete(col.key);
                              saveColSettings(next);
                            }} className="text-gray-400 hover:text-red-500 transition">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                      </div>
                    );
                  })}
                  {visibleCols.size === REQUIRED_COLS.size && (
                    <p className="text-xs text-gray-400 italic text-center py-4">Chưa chọn cột tùy chọn nào</p>
                  )}
                </div>
              </div>
            </div>
            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
              <button onClick={() => saveColSettings(new Set(DEFAULT_COLS))}
                className="text-sm text-gray-500 hover:text-blue-600 transition">
                Đặt lại mặc định
              </button>
              <button onClick={() => setShowColSettings(false)}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition">
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
