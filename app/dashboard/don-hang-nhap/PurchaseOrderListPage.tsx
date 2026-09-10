'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { purchaseOrdersApi } from '@/lib/purchase-orders';
import { branchesApi } from '@/lib/branches';
import { localDateStr } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Branch { id: number; name: string; }
interface Supplier { id: number; code: string; name: string; phone?: string; supplierType?: string | null; }
interface POItem {
  id?: number; productId?: number | null; productCode: string; productName: string;
  unit: string; quantity: number; priceForeign: number; discountPercent: number;
  totalForeign: number; priceVnd: number; totalVnd: number; notes?: string | null;
}
interface POPayment {
  id: number; amount: number; paymentTarget: string; amountForeign: number;
  paymentMethod: string; date?: string | null;
  reference?: string | null; notes?: string | null; transactionId?: number | null;
  createdAt: string;
}
interface PurchaseOrder {
  id: number; code: string; orderType: string; date: string | null;
  expectedDeliveryDate: string | null; receivedDate: string | null;
  status: string; paymentStatus: string;
  currency: string; exchangeRate: number;
  subtotalForeign: number; subtotalVnd: number; discountAmount: number;
  shippingFee: number; totalAmountVnd: number;
  paidAmountVnd: number; debtAmountVnd: number;
  paidAmountForeign: number; debtAmountForeign: number;
  shippingFeePaid: number; shippingFeeDebt: number;
  notes: string | null; tags: string | null; reference: string | null; cancelReason: string | null;
  supplier?: Supplier | null;
  freightAgent?: Supplier | null; freightAgentId?: number | null;
  assignedTo?: { id: number; fullName?: string; username: string } | null;
  items: POItem[]; payments: POPayment[]; createdAt: string; updatedAt: string;
}
interface Stats {
  totalOrders: number; totalAmount: number; totalPaid: number; totalDebt: number;
  byStatus: Record<string, number>;
  debtVnd?: number; debtCny?: number; debtUsd?: number; shippingDebt?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp', ordered: 'Đã đặt', received: 'Đã nhận', cancelled: 'Đã hủy',
};
const STATUS_STYLE: Record<string, string> = {
  draft:     'bg-gray-50 text-gray-500 border border-gray-200',
  ordered:   'bg-blue-50 text-blue-600 border border-blue-100',
  received:  'bg-emerald-50 text-emerald-600 border border-emerald-100',
  cancelled: 'bg-red-50 text-red-400 border border-red-100',
};
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: 'Chưa TT', partial: 'Một phần', paid: 'Đã TT',
};
const PAYMENT_STATUS_STYLE: Record<string, string> = {
  unpaid:  'bg-red-50 text-red-500 border border-red-100',
  partial: 'bg-amber-50 text-amber-600 border border-amber-100',
  paid:    'bg-emerald-50 text-emerald-600 border border-emerald-100',
};
const CURRENCY_LABEL: Record<string, string> = { VND: 'VND', CNY: 'CNY (¥)', USD: 'USD ($)' };

const TABS = [
  { key: '', label: 'Tất cả' }, { key: 'draft', label: 'Nháp' },
  { key: 'ordered', label: 'Đã đặt' }, { key: 'received', label: 'Đã nhận' },
  { key: 'cancelled', label: 'Đã hủy' },
];
const DATE_PRESETS = [
  { key: 'today', label: 'Hôm nay' }, { key: 'yesterday', label: 'Hôm qua' },
  { key: 'this_week', label: 'Tuần này' }, { key: 'last_week', label: 'Tuần trước' },
  { key: 'this_month', label: 'Tháng này' }, { key: 'last_month', label: 'Tháng trước' },
];

// ─── Column manager ───────────────────────────────────────────────────────────
const COL_STORAGE_KEY = 'po-list-cols';
const ALL_COLUMNS = [
  { key: 'date',           label: 'Ngày đặt' },
  { key: 'expectedDate',   label: 'Dự kiến nhận' },
  { key: 'receivedDate',   label: 'Ngày nhận' },
  { key: 'supplier',       label: 'Nhà cung cấp' },
  { key: 'freightAgent',   label: 'Công ty VC' },
  { key: 'assignedTo',     label: 'Nhân viên' },
  { key: 'orderType',      label: 'Loại đơn' },
  { key: 'totalAmountVnd', label: 'Tổng tiền' },
  { key: 'paidAmountVnd',  label: 'Đã TT' },
  { key: 'debtAmountVnd',  label: 'Còn nợ' },
  { key: 'shippingFee',    label: 'Phí VC' },
  { key: 'status',         label: 'TT đơn' },
  { key: 'paymentStatus',  label: 'TT thanh toán' },
  { key: 'currency',       label: 'Tiền tệ' },
  { key: 'reference',      label: 'Tham chiếu' },
  { key: 'tags',           label: 'Tags' },
  { key: 'notes',          label: 'Ghi chú' },
  { key: 'createdAt',      label: 'Ngày tạo' },
] as const;
type ColKey = typeof ALL_COLUMNS[number]['key'];
const DEFAULT_VISIBLE: ColKey[] = ['date', 'supplier', 'orderType', 'totalAmountVnd', 'debtAmountVnd', 'status', 'paymentStatus'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtMoney = (n: number | string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(n));
const fmtNum = (n: number | string, decimals = 0) =>
  Number(n).toLocaleString('vi-VN', { maximumFractionDigits: decimals });
const fmtDate = (s: string | null | undefined) => s ? new Date(s).toLocaleDateString('vi-VN') : '—';
const today = () => localDateStr();

function presetToDates(preset: string) {
  const d = new Date();
  const fmt = localDateStr;
  if (preset === 'today')      return { from: fmt(d), to: fmt(d) };
  if (preset === 'yesterday')  { const x = new Date(d); x.setDate(x.getDate()-1); return { from: fmt(x), to: fmt(x) }; }
  if (preset === 'this_week')  { const x = new Date(d); x.setDate(x.getDate()-x.getDay()+1); return { from: fmt(x), to: fmt(d) }; }
  if (preset === 'last_week')  { const s = new Date(d); s.setDate(s.getDate()-s.getDay()-6); const e = new Date(s); e.setDate(e.getDate()+6); return { from: fmt(s), to: fmt(e) }; }
  if (preset === 'this_month') { return { from: fmt(new Date(d.getFullYear(), d.getMonth(), 1)), to: fmt(d) }; }
  if (preset === 'last_month') { const s = new Date(d.getFullYear(), d.getMonth()-1, 1); const e = new Date(d.getFullYear(), d.getMonth(), 0); return { from: fmt(s), to: fmt(e) }; }
  return { from: '', to: '' };
}

// ─── SortIcon ─────────────────────────────────────────────────────────────────
function SortIcon({ col, sortBy, sortOrder }: { col: string; sortBy: string; sortOrder: string }) {
  if (sortBy !== col) return <span className="text-gray-300 ml-1">↕</span>;
  return <span className="text-blue-500 ml-1">{sortOrder === 'ASC' ? '↑' : '↓'}</span>;
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] w-full ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PurchaseOrderListPage({
  fixedOrderType,
}: {
  fixedOrderType?: 'domestic' | 'import';
}) {
  const router = useRouter();
  const createPath = fixedOrderType === 'import'
    ? '/dashboard/don-hang-nhap/nhap-khau/tao'
    : '/dashboard/don-hang-nhap/trong-nuoc/tao';

  const pageTitle = fixedOrderType === 'domestic'
    ? 'Đơn Nhập Trong Nước'
    : fixedOrderType === 'import'
    ? 'Đơn Nhập Khẩu'
    : 'Đơn Hàng Nhập';
  const pageDesc = fixedOrderType === 'domestic'
    ? 'Quản lý nhập hàng từ nhà cung cấp trong nước'
    : fixedOrderType === 'import'
    ? 'Quản lý nhập khẩu · CNY / USD'
    : 'Quản lý nhập hàng trong nước và nhập khẩu';

  // ─ List state ─
  const [records, setRecords]   = useState<PurchaseOrder[]>([]);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab]           = useState('');
  const [search, setSearch]     = useState('');
  const [filterHasDebt, setFilterHasDebt] = useState('');
  const [filterDatePreset, setFilterDatePreset] = useState('this_month');
  const [filterFrom, setFilterFrom] = useState(() => presetToDates('this_month').from);
  const [filterTo, setFilterTo]     = useState(() => presetToDates('this_month').to);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [showDateDrop, setShowDateDrop] = useState(false);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [limit, setLimit]         = useState<20 | 50 | 100>(20);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy]         = useState('createdAt');
  const [sortOrder, setSortOrder]   = useState<'ASC' | 'DESC'>('DESC');
  const [selected, setSelected]   = useState<number[]>([]);
  const [exporting, setExporting] = useState(false);
  const [filterBranch, setFilterBranch] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [debtAllTime, setDebtAllTime] = useState({ total: 0, vnd: 0, cny: 0, usd: 0, shipping: 0 });

  // ─ Column manager state ─
  const [visibleCols, setVisibleCols] = useState<ColKey[]>(() => {
    try { const s = localStorage.getItem(COL_STORAGE_KEY + '-vis'); if (s) return JSON.parse(s); } catch { /**/ }
    return DEFAULT_VISIBLE;
  });
  const [colOrder, setColOrder] = useState<ColKey[]>(() => {
    try { const s = localStorage.getItem(COL_STORAGE_KEY + '-ord'); if (s) return JSON.parse(s); } catch { /**/ }
    return ALL_COLUMNS.map(c => c.key);
  });
  const [showColModal, setShowColModal] = useState(false);
  const [dragKey, setDragKey]       = useState<ColKey | null>(null);
  const [dragOverKey, setDragOverKey] = useState<ColKey | null>(null);

  const dateDropRef = useRef<HTMLDivElement>(null);

  const orderedVisible = colOrder.filter(k => visibleCols.includes(k) && (fixedOrderType ? k !== 'orderType' : true));

  // ─ Load ─
  const load = useCallback(async (
    s = search, p = page, t = tab, hd = filterHasDebt,
    fr = filterFrom, to = filterTo, lm = limit, sb = sortBy, so = sortOrder, br = filterBranch
  ) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p), limit: String(lm), sortBy: sb, sortOrder: so };
      if (t)              params.status    = t;
      if (s)              params.search    = s;
      if (hd)             params.hasDebt   = hd;
      if (fr)             params.dateFrom  = fr;
      if (to)             params.dateTo    = to;
      if (br)             params.branchId  = br;
      if (fixedOrderType) params.orderType = fixedOrderType;
      const statsParams: Record<string, string> = {};
      if (fr) statsParams.dateFrom = fr;
      if (to) statsParams.dateTo   = to;
      if (fixedOrderType) statsParams.orderType = fixedOrderType;
      const [res, st2] = await Promise.all([
        purchaseOrdersApi.getAll(params),
        purchaseOrdersApi.getStats(statsParams),
      ]);
      setRecords(res.data ?? []); setTotal(res.total ?? 0); setTotalPages(res.totalPages ?? 1);
      setStats(st2); setLoadError('');
    } catch (e: unknown) { setLoadError(e instanceof Error ? e.message : 'Không tải được dữ liệu'); }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page, tab, filterHasDebt, filterFrom, filterTo, limit, sortBy, sortOrder, filterBranch, fixedOrderType]);

  useEffect(() => { load(); }, []); // eslint-disable-line

  // Load branches + all-time debt (once, not re-fetched on date filter change)
  useEffect(() => {
    branchesApi.getAll(true).then((data: Branch[]) => setBranches(data)).catch(() => {});
    const p: Record<string, string> = {};
    if (fixedOrderType) p.orderType = fixedOrderType;
    purchaseOrdersApi.getStats(p).then((s) => setDebtAllTime({
      total:    Number(s.totalDebt     ?? 0),
      vnd:      Number(s.debtVnd      ?? 0),
      cny:      Number(s.debtCny      ?? 0),
      usd:      Number(s.debtUsd      ?? 0),
      shipping: Number(s.shippingDebt ?? 0),
    })).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedOrderType]);

  // Close date dropdown on outside click
  useEffect(() => {
    function h(e: MouseEvent) { if (dateDropRef.current && !dateDropRef.current.contains(e.target as Node)) setShowDateDrop(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ─ Handlers ─
  function handleSort(col: string) {
    const so = sortBy === col && sortOrder === 'DESC' ? 'ASC' : 'DESC';
    setSortBy(col); setSortOrder(so); setPage(1);
    load(search, 1, tab, filterHasDebt, filterFrom, filterTo, limit, col, so, filterBranch);
  }

  function handlePage(p: number) {
    if (p < 1 || p > totalPages) return;
    setPage(p); load(search, p, tab, filterHasDebt, filterFrom, filterTo, limit, sortBy, sortOrder, filterBranch);
  }

  function handleSearch(v: string) {
    setSearch(v); setPage(1);
    load(v, 1, tab, filterHasDebt, filterFrom, filterTo, limit, sortBy, sortOrder, filterBranch);
  }

  function handleTab(t: string) {
    setTab(t); setPage(1); setSelected([]);
    load(search, 1, t, filterHasDebt, filterFrom, filterTo, limit, sortBy, sortOrder, filterBranch);
  }

  function handleBranch(br: string) {
    setFilterBranch(br); setPage(1);
    load(search, 1, tab, filterHasDebt, filterFrom, filterTo, limit, sortBy, sortOrder, br);
  }

  function applyDatePreset(key: string) {
    setFilterDatePreset(key);
    const { from, to } = presetToDates(key);
    setFilterFrom(from); setFilterTo(to); setShowDateDrop(false); setPage(1);
    load(search, 1, tab, filterHasDebt, from, to, limit, sortBy, sortOrder, filterBranch);
  }

  function applyCustomDate() {
    setFilterDatePreset(''); setShowDateDrop(false); setPage(1);
    load(search, 1, tab, filterHasDebt, customFrom, customTo, limit, sortBy, sortOrder, filterBranch);
  }

  function clearDate() {
    setFilterDatePreset(''); setFilterFrom(''); setFilterTo('');
    setCustomFrom(''); setCustomTo(''); setShowDateDrop(false); setPage(1);
    load(search, 1, tab, filterHasDebt, '', '', limit, sortBy, sortOrder, filterBranch);
  }

  async function handleBulkStatus(status: string) {
    if (!selected.length) return;
    if (!confirm(`Cập nhật ${selected.length} đơn sang "${STATUS_LABEL[status]}"?`)) return;
    try { await purchaseOrdersApi.bulkUpdateStatus(selected, status); setSelected([]); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Lỗi'); }
  }

  function handleExportSelected() {
    const rows = records.filter(r => selected.includes(r.id));
    if (!rows.length) return;
    const headers = ['Mã đơn', 'Loại', 'Ngày đặt', 'NCC', 'Tiền tệ', 'Tổng (VND)', 'Nợ NCC', 'Nợ phí VC', 'TT đơn', 'TT thanh toán'];
    const data = rows.map(r => [
      r.code, r.orderType === 'import' ? 'Nhập khẩu' : 'Trong nước',
      r.date ?? '', r.supplier?.name ?? '', r.currency,
      Number(r.totalAmountVnd), Number(r.debtAmountVnd), Number(r.shippingFeeDebt),
      STATUS_LABEL[r.status] ?? r.status, PAYMENT_STATUS_LABEL[r.paymentStatus] ?? r.paymentStatus,
    ]);
    const csv = [headers, ...data].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${fixedOrderType ?? 'don-hang-nhap'}-selected-${today()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params: Record<string, string> = { page: '1', limit: '9999' };
      if (tab)            params.status    = tab;
      if (search)         params.search    = search;
      if (filterHasDebt)  params.hasDebt   = filterHasDebt;
      if (filterFrom)     params.dateFrom  = filterFrom;
      if (filterTo)       params.dateTo    = filterTo;
      if (fixedOrderType) params.orderType = fixedOrderType;
      const res = await purchaseOrdersApi.getAll(params);
      const headers = ['Mã đơn', 'Loại', 'Ngày đặt', 'NCC', 'Tiền tệ', 'Tổng (VND)', 'Nợ NCC', 'Nợ phí VC', 'TT đơn', 'TT thanh toán'];
      const rows = (res.data ?? []).map((r: PurchaseOrder) => [
        r.code, r.orderType === 'import' ? 'Nhập khẩu' : 'Trong nước',
        r.date ?? '', r.supplier?.name ?? '', r.currency,
        Number(r.totalAmountVnd), Number(r.debtAmountVnd), Number(r.shippingFeeDebt),
        STATUS_LABEL[r.status] ?? r.status, PAYMENT_STATUS_LABEL[r.paymentStatus] ?? r.paymentStatus,
      ]);
      const csv = [headers, ...rows].map(row => row.map((c: unknown) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${fixedOrderType ?? 'don-hang-nhap'}-${today()}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch { /**/ }
    setExporting(false);
  }

  // ─ Column manager helpers ─
  function saveColSettings(vis: ColKey[], ord: ColKey[]) {
    try {
      localStorage.setItem(COL_STORAGE_KEY + '-vis', JSON.stringify(vis));
      localStorage.setItem(COL_STORAGE_KEY + '-ord', JSON.stringify(ord));
    } catch { /**/ }
    setVisibleCols(vis); setColOrder(ord);
  }

  function toggleCol(key: ColKey) {
    const next = visibleCols.includes(key) ? visibleCols.filter(k => k !== key) : [...visibleCols, key];
    saveColSettings(next, colOrder);
  }

  function handleDragStart(key: ColKey) { setDragKey(key); }
  function handleDragOver(e: React.DragEvent, key: ColKey) { e.preventDefault(); setDragOverKey(key); }
  function handleDrop(key: ColKey) {
    if (!dragKey || dragKey === key) { setDragKey(null); setDragOverKey(null); return; }
    const ord = [...colOrder];
    const from = ord.indexOf(dragKey); const to = ord.indexOf(key);
    ord.splice(from, 1); ord.splice(to, 0, dragKey);
    saveColSettings(visibleCols, ord);
    setDragKey(null); setDragOverKey(null);
  }

  // ─ Derived ─
  const allChecked = records.length > 0 && records.every(r => selected.includes(r.id));
  const pageFrom   = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageTo     = Math.min(page * limit, total);

  // ─ Table cell renderers ─
  function renderHeaderCell(key: ColKey) {
    const label = ALL_COLUMNS.find(c => c.key === key)?.label ?? key;
    const sortable = ['date', 'totalAmountVnd', 'debtAmountVnd', 'createdAt', 'expectedDate', 'receivedDate'].includes(key);
    const align = ['totalAmountVnd', 'paidAmountVnd', 'debtAmountVnd', 'shippingFee'].includes(key) ? 'text-right' : 'text-left';
    return (
      <th key={key} className={`px-4 py-3 ${align} ${sortable ? 'cursor-pointer hover:text-gray-700 whitespace-nowrap' : 'whitespace-nowrap'}`}
        onClick={sortable ? () => handleSort(key) : undefined}>
        {label} {sortable && <SortIcon col={key} sortBy={sortBy} sortOrder={sortOrder} />}
      </th>
    );
  }

  function renderCell(key: ColKey, po: PurchaseOrder) {
    const totalDebt = Number(po.debtAmountVnd) + Number(po.shippingFeeDebt);
    switch (key) {
      case 'date':          return <td key={key} className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(po.date)}</td>;
      case 'expectedDate':  return <td key={key} className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(po.expectedDeliveryDate)}</td>;
      case 'receivedDate':  return <td key={key} className="px-4 py-3 whitespace-nowrap">{po.receivedDate ? <span className="text-emerald-600 font-medium">{fmtDate(po.receivedDate)}</span> : <span className="text-gray-300">—</span>}</td>;
      case 'supplier':      return <td key={key} className="px-4 py-3"><div className="font-medium text-gray-800 truncate max-w-[160px]">{po.supplier?.name ?? <span className="text-gray-300">—</span>}</div></td>;
      case 'freightAgent':  return <td key={key} className="px-4 py-3"><div className="text-amber-700 truncate max-w-[120px]">{po.freightAgent?.name ?? <span className="text-gray-300">—</span>}</div></td>;
      case 'assignedTo':    return <td key={key} className="px-4 py-3 text-gray-600">{po.assignedTo?.fullName ?? po.assignedTo?.username ?? <span className="text-gray-300">—</span>}</td>;
      case 'orderType':     return <td key={key} className="px-4 py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${po.orderType === 'import' ? 'bg-purple-50 text-purple-600' : 'bg-gray-50 text-gray-500'}`}>{po.orderType === 'import' ? 'Nhập khẩu' : 'Trong nước'}</span></td>;
      case 'totalAmountVnd':return <td key={key} className="px-4 py-3 text-right font-medium text-gray-800">{fmtMoney(po.totalAmountVnd)}</td>;
      case 'paidAmountVnd': return <td key={key} className="px-4 py-3 text-right text-emerald-600 font-medium">{Number(po.paidAmountVnd) > 0 ? fmtMoney(po.paidAmountVnd) : <span className="text-gray-300">—</span>}</td>;
      case 'debtAmountVnd': return <td key={key} className="px-4 py-3 text-right">{totalDebt > 0 ? <div><span className="font-medium text-red-500">{fmtMoney(totalDebt)}</span>{Number(po.shippingFeeDebt) > 0 && <div className="text-xs text-amber-600">VC: {fmtMoney(po.shippingFeeDebt)}</div>}</div> : <span className="text-gray-300 text-xs">—</span>}</td>;
      case 'shippingFee':   return <td key={key} className="px-4 py-3 text-right text-gray-600">{Number(po.shippingFee) > 0 ? fmtMoney(po.shippingFee) : <span className="text-gray-300">—</span>}</td>;
      case 'status':        return <td key={key} className="px-4 py-3 text-center"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLE[po.status]}`}>{STATUS_LABEL[po.status]}</span></td>;
      case 'paymentStatus': return <td key={key} className="px-4 py-3 text-center"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PAYMENT_STATUS_STYLE[po.paymentStatus]}`}>{PAYMENT_STATUS_LABEL[po.paymentStatus]}</span></td>;
      case 'currency':      return <td key={key} className="px-4 py-3 text-center text-sm text-gray-600">{CURRENCY_LABEL[po.currency] ?? po.currency}</td>;
      case 'reference':     return <td key={key} className="px-4 py-3 text-sm text-gray-500 font-mono">{po.reference ?? <span className="text-gray-300">—</span>}</td>;
      case 'tags':          return <td key={key} className="px-4 py-3"><div className="flex flex-wrap gap-1">{po.tags ? po.tags.split(',').map(t => <span key={t} className="text-[11px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">{t.trim()}</span>) : <span className="text-gray-300">—</span>}</div></td>;
      case 'notes':         return <td key={key} className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">{po.notes ?? <span className="text-gray-300">—</span>}</td>;
      case 'createdAt':     return <td key={key} className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">{fmtDate(po.createdAt)}</td>;
      default:              return <td key={key} />;
    }
  }

  return (
    <div className="p-6 space-y-5 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {filterFrom && filterTo ? `Đang xem: ${fmtDate(filterFrom)} – ${fmtDate(filterTo)}` : pageDesc}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Branch filter */}
          <select value={filterBranch} onChange={e => handleBranch(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 bg-white text-gray-700 min-w-[160px]">
            <option value="">Tất cả chi nhánh</option>
            {branches.map(b => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
          </select>

          {/* Date filter */}
          <div className="relative" ref={dateDropRef}>
            <button onClick={() => setShowDateDrop(v => !v)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border rounded-xl hover:border-blue-400 transition shadow-sm min-w-[140px] ${filterFrom ? 'border-blue-300 text-blue-700' : 'border-gray-200 text-gray-700'}`}>
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span className="flex-1 truncate">{filterDatePreset ? DATE_PRESETS.find(p => p.key === filterDatePreset)?.label ?? 'Tùy chọn' : 'Ngày đặt'}</span>
              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showDateDrop && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 p-3">
                <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-2 px-0.5">Lọc theo ngày đặt</p>
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  {DATE_PRESETS.map(p => (
                    <button key={p.key} onClick={() => applyDatePreset(p.key)}
                      className={`px-3 py-2 rounded-xl text-sm text-left font-medium transition ${
                        filterDatePreset === p.key ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">Tùy chọn</p>
                  <div className="flex gap-2">
                    <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-300" />
                    <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-300" />
                  </div>
                  <button onClick={applyCustomDate} className="w-full py-1.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition">Lọc</button>
                </div>
                {(filterDatePreset || filterFrom) && (
                  <button onClick={clearDate} className="w-full text-center pt-2 mt-2 text-xs text-red-500 hover:text-red-600 border-t border-gray-100">Xoá bộ lọc ngày</button>
                )}
              </div>
            )}
          </div>

          <button onClick={() => router.push(createPath)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Tạo đơn nhập
          </button>
        </div>
      </div>

      {/* KPI bar */}
      {stats && (<>
        <div className="grid grid-cols-4 gap-3">
          {([
            { label: 'Tổng đơn nhập', value: stats.totalOrders.toLocaleString(),  iconColor: 'text-slate-400', numColor: 'text-slate-700',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /> },
            { label: 'Tổng giá trị',  value: fmtMoney(stats.totalAmount),         iconColor: 'text-blue-400', numColor: 'text-blue-600',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> },
            { label: 'Đã thanh toán', value: fmtMoney(stats.totalPaid),           iconColor: 'text-emerald-400', numColor: 'text-emerald-600',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> },
            { label: fixedOrderType === 'domestic' ? 'Tổng nợ NCC' : 'Nợ NCC (ước tính)',
              value: fmtMoney(fixedOrderType === 'domestic' ? debtAllTime.vnd || 0 : (debtAllTime.total - debtAllTime.shipping) || 0),
              iconColor: 'text-red-400', numColor: 'text-red-600',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
          ] as const).map(k => (
            <div key={k.label} className={"bg-white rounded-lg border border-gray-100 shadow-sm flex items-center gap-2.5 px-3 py-2"}>
              <div className="w-6 h-6 rounded-md bg-gray-50 flex items-center justify-center flex-shrink-0">
                <svg className={`w-3 h-3 ${k.iconColor ?? 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">{k.icon}</svg>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 font-medium leading-none">{k.label}</p>
                <p className={`text-sm font-bold mt-0.5 leading-tight truncate ${k.numColor ?? 'text-slate-700'}`}>{k.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Công nợ theo tiền tệ gốc — chips nhỏ, hiện tại (all-time) */}
        {(debtAllTime.cny > 0 || debtAllTime.usd > 0 || debtAllTime.shipping > 0) && (
          <div className="flex gap-2 flex-wrap">
            {debtAllTime.cny > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-100">
                <span className="w-5 h-5 rounded-md bg-amber-500 flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">¥</span>
                <span className="text-[10px] text-amber-500 font-medium">Nợ CNY</span>
                <span className="text-sm font-semibold text-amber-700">¥ {(debtAllTime.cny || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</span>
              </div>
            )}
            {(debtAllTime.usd > 0 || fixedOrderType === 'import') && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-50 border border-yellow-100">
                <span className="w-5 h-5 rounded-md bg-yellow-600 flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">$</span>
                <span className="text-[10px] text-yellow-600 font-medium">Nợ USD</span>
                <span className="text-sm font-semibold text-yellow-700">$ {(debtAllTime.usd || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</span>
              </div>
            )}
            {(debtAllTime.shipping > 0 || fixedOrderType === 'import') && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-100">
                <span className="w-5 h-5 rounded-md bg-sky-500 flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">VC</span>
                <span className="text-[10px] text-sky-500 font-medium">
                  {fixedOrderType === 'domestic' ? 'Nợ VC trong nước' : 'Nợ VC nhập khẩu'}
                </span>
                <span className="text-sm font-semibold text-sky-700">{fmtMoney(debtAllTime.shipping || 0)}</span>
              </div>
            )}
          </div>
        )}
      </>)}

      {/* Table card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center border-b border-gray-100 overflow-x-auto relative">
          {TABS.filter(t => fixedOrderType ? true : true).map(t => (
            <button key={t.key} onClick={() => handleTab(t.key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${tab === t.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
              {stats && t.key !== '' && stats.byStatus[t.key] > 0 && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 rounded-full px-1.5">{stats.byStatus[t.key]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 flex-wrap">
          {/* Gear — chọn cột */}
          <button onClick={() => setShowColModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 bg-white flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Chọn cột <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-medium">{orderedVisible.length}</span>
          </button>

          <div className="relative flex-1 min-w-[240px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={search} onChange={e => handleSearch(e.target.value)}
              placeholder="Tìm mã đơn, NCC, tham chiếu..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-blue-400 bg-white" />
          </div>

          <select value={filterHasDebt} onChange={e => { setFilterHasDebt(e.target.value); setPage(1); load(search, 1, tab, e.target.value, filterFrom, filterTo); }}
            className={`px-3 py-2 text-sm rounded-xl border transition bg-white ${filterHasDebt ? 'border-blue-300 text-blue-700 bg-blue-50 font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <option value="">Công nợ</option>
            <option value="true">Còn nợ</option>
          </select>

          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 bg-white disabled:opacity-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            {exporting ? '...' : 'Xuất CSV'}
          </button>
        </div>

        {/* Bulk actions */}
        {selected.length > 0 && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
            <span className="text-sm text-blue-700 font-medium">{selected.length} đơn đã chọn</span>
            <button onClick={() => handleBulkStatus('ordered')} className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700">→ Đã đặt</button>
            <button onClick={() => handleBulkStatus('received')} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">✓ Nhận hàng</button>
            <button onClick={() => handleBulkStatus('cancelled')} className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700">Huỷ</button>
            <button onClick={handleExportSelected} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-100">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Xuất CSV
            </button>
            <button onClick={() => setSelected([])} className="text-xs text-gray-500 hover:text-gray-700 ml-auto">Bỏ chọn</button>
          </div>
        )}

        {loadError && <div className="m-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{loadError}</div>}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr className="text-xs text-gray-500 font-medium">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={allChecked} onChange={e => setSelected(e.target.checked ? records.map(r => r.id) : [])} className="w-4 h-4 rounded border-gray-300" />
                </th>
                <th className="px-4 py-3 text-left cursor-pointer hover:text-gray-700 whitespace-nowrap" onClick={() => handleSort('code')}>
                  Mã đơn <SortIcon col="code" sortBy={sortBy} sortOrder={sortOrder} />
                </th>
                {orderedVisible.map(k => renderHeaderCell(k))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={2 + orderedVisible.length} className="px-4 py-16 text-center text-gray-400 text-sm">Đang tải...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={2 + orderedVisible.length} className="px-4 py-16 text-center text-gray-400 text-sm">Không có dữ liệu</td></tr>
              ) : records.map(po => (
                <tr key={po.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => router.push('/dashboard/don-hang-nhap/' + po.id)}>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.includes(po.id)}
                      onChange={e => setSelected(prev => e.target.checked ? [...prev, po.id] : prev.filter(i => i !== po.id))}
                      className="w-4 h-4 rounded border-gray-300" />
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => router.push('/dashboard/don-hang-nhap/' + po.id)} className="font-mono font-medium text-blue-600 hover:text-blue-700 hover:underline">
                      {po.code}
                    </button>
                  </td>
                  {orderedVisible.map(k => renderCell(k, po))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              {([20, 50, 100] as const).map(n => (
                <button key={n} onClick={() => { setLimit(n); setPage(1); load(search, 1, tab, filterHasDebt, filterFrom, filterTo, n); }}
                  className={`px-3 py-1.5 text-xs transition ${limit === n ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                  {n}
                </button>
              ))}
            </div>
            <span>
              Hiển thị{' '}
              {total === 0 ? '0' : `${pageFrom}–${pageTo}`}
              {' '}trên tổng <span className="font-semibold text-gray-600">{total}</span> đơn
            </span>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => handlePage(1)} disabled={page === 1} title="Trang đầu"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs font-medium">«</button>
              <button onClick={() => handlePage(page - 1)} disabled={page === 1} title="Trang trước"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs">‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                  acc.push(p); return acc;
                }, [])
                .map((item, idx) =>
                  item === 'ellipsis'
                    ? <span key={`e${idx}`} className="w-7 h-7 flex items-center justify-center text-gray-400 text-xs">…</span>
                    : <button key={item} onClick={() => handlePage(item as number)}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition ${page === item ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>
                        {item}
                      </button>
                )}
              <button onClick={() => handlePage(page + 1)} disabled={page === totalPages} title="Trang sau"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs">›</button>
              <button onClick={() => handlePage(totalPages)} disabled={page === totalPages} title="Trang cuối"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs font-medium">»</button>
            </div>
          )}
        </div>
      </div>

      {/* Column manager modal */}
      {showColModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">Điều chỉnh cột hiển thị</h2>
              <button onClick={() => setShowColModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-100 min-h-[360px]">
              {/* Left: toggle visibility */}
              <div className="p-5 overflow-y-auto max-h-[420px]">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Hiển thị / Ẩn</p>
                <div className="text-xs text-gray-400 mb-2 border-b pb-2 border-gray-100">Mã đơn (cố định)</div>
                {ALL_COLUMNS.filter(c => fixedOrderType ? c.key !== 'orderType' : true).map(col => (
                  <label key={col.key} className="flex items-center gap-2 py-1.5 cursor-pointer hover:text-gray-700 text-sm text-gray-600">
                    <input type="checkbox" checked={visibleCols.includes(col.key)} onChange={() => toggleCol(col.key)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                    {col.label}
                  </label>
                ))}
              </div>
              {/* Right: drag to reorder */}
              <div className="p-5 overflow-y-auto max-h-[420px]">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Thứ tự cột (kéo thả)</p>
                <div className="text-xs text-gray-400 mb-1 border-b pb-2 border-gray-100">Mã đơn (đầu tiên)</div>
                {colOrder.filter(k => fixedOrderType ? k !== 'orderType' : true).map(key => {
                  const col = ALL_COLUMNS.find(c => c.key === key);
                  if (!col) return null;
                  return (
                    <div key={key} draggable
                      onDragStart={() => handleDragStart(key)}
                      onDragOver={e => handleDragOver(e, key)}
                      onDrop={() => handleDrop(key)}
                      className={`flex items-center gap-2 py-2 px-2 rounded-lg cursor-grab text-sm transition ${dragOverKey === key ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-600'} ${!visibleCols.includes(key) ? 'opacity-40' : ''}`}>
                      <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                      {col.label}
                    </div>
                  );
                })}
                <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">(Thao tác — cuối)</div>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button onClick={() => { saveColSettings(DEFAULT_VISIBLE, ALL_COLUMNS.map(c => c.key)); }}
                className="text-sm text-gray-500 hover:text-gray-700">Quay về mặc định</button>
              <div className="flex gap-2">
                <button onClick={() => setShowColModal(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Thoát</button>
                <button onClick={() => setShowColModal(false)} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">Lưu</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
