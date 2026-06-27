'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getPurchaseReturns, getPurchaseReturnStats,
  PurchaseReturn, PurchaseReturnStats, LOAI_TRA_HANG, LoaiTraHang,
} from '@/lib/purchase-returns';
import { branchesApi } from '@/lib/branches';
import { localDateStr } from '@/lib/utils';

interface Branch { id: number; name: string; }

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp', sent: 'Đã gửi NCC', confirmed: 'Đã xác nhận', cancelled: 'Đã huỷ',
};
const STATUS_STYLE: Record<string, string> = {
  draft:     'bg-amber-50 text-amber-600 border border-amber-100',
  sent:      'bg-blue-50 text-blue-600 border border-blue-100',
  confirmed: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
  cancelled: 'bg-gray-100 text-gray-500 border border-gray-200',
};

const DATE_PRESETS = [
  { key: 'today',      label: 'Hôm nay' },
  { key: 'yesterday',  label: 'Hôm qua' },
  { key: 'this_week',  label: 'Tuần này' },
  { key: 'last_week',  label: 'Tuần trước' },
  { key: 'this_month', label: 'Tháng này' },
  { key: 'last_month', label: 'Tháng trước' },
];

// ─── Column manager ───────────────────────────────────────────────────────────
const COL_STORAGE_KEY = 'pr-ncc-list-cols';
const ALL_COLUMNS = [
  { key: 'returnDate',     label: 'Ngày trả' },
  { key: 'supplier',       label: 'Nhà cung cấp' },
  { key: 'branch',         label: 'Chi nhánh' },
  { key: 'purchaseOrder',  label: 'Đơn nhập gốc' },
  { key: 'itemCount',      label: 'Số SP' },
  { key: 'totalAmountVnd', label: 'Tổng tiền' },
  { key: 'refundStatus',   label: 'Hoàn tiền' },
  { key: 'status',         label: 'Trạng thái' },
  { key: 'loaiTraHang',    label: 'Loại trả' },
  { key: 'reason',         label: 'Lý do' },
  { key: 'actorName',      label: 'Người tạo' },
  { key: 'createdAt',      label: 'Ngày tạo' },
] as const;
type ColKey = typeof ALL_COLUMNS[number]['key'];
const DEFAULT_VISIBLE: ColKey[] = ['returnDate', 'supplier', 'branch', 'purchaseOrder', 'itemCount', 'totalAmountVnd', 'refundStatus', 'status'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt     = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const fmtDate = (s: string | null | undefined) => s ? new Date(s).toLocaleDateString('vi-VN') : '—';

function presetToDates(preset: string) {
  const d   = new Date();
  const fmt = localDateStr;
  if (preset === 'today')      return { from: fmt(d), to: fmt(d) };
  if (preset === 'yesterday')  { const x = new Date(d); x.setDate(x.getDate() - 1); return { from: fmt(x), to: fmt(x) }; }
  if (preset === 'this_week')  { const x = new Date(d); x.setDate(x.getDate() - x.getDay() + 1); return { from: fmt(x), to: fmt(d) }; }
  if (preset === 'last_week')  { const s = new Date(d); s.setDate(s.getDate() - s.getDay() - 6); const e = new Date(s); e.setDate(e.getDate() + 6); return { from: fmt(s), to: fmt(e) }; }
  if (preset === 'this_month') return { from: fmt(new Date(d.getFullYear(), d.getMonth(), 1)), to: fmt(d) };
  if (preset === 'last_month') { const s = new Date(d.getFullYear(), d.getMonth() - 1, 1); const e = new Date(d.getFullYear(), d.getMonth(), 0); return { from: fmt(s), to: fmt(e) }; }
  return { from: '', to: '' };
}

function SortIcon({ col, sortBy, sortOrder }: { col: string; sortBy: string; sortOrder: string }) {
  if (sortBy !== col) return <span className="text-gray-300 ml-1">↕</span>;
  return <span className="text-blue-500 ml-1">{sortOrder === 'ASC' ? '↑' : '↓'}</span>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PurchaseReturnsListPage() {
  const router = useRouter();

  // list
  const [records, setRecords]     = useState<PurchaseReturn[]>([]);
  const [stats, setStats]         = useState<PurchaseReturnStats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab]             = useState('');
  const [search, setSearch]       = useState('');
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [limit, setLimit]         = useState<20 | 50 | 100>(20);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy]       = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // branch + refund + loaiTraHang filter
  const [filterBranch, setFilterBranch]         = useState('');
  const [filterRefund, setFilterRefund]         = useState('');
  const [filterLoaiTraHang, setFilterLoaiTraHang] = useState('');
  const [branches, setBranches]                 = useState<Branch[]>([]);

  // date filter
  const [filterDatePreset, setFilterDatePreset] = useState('this_month');
  const [filterFrom, setFilterFrom]   = useState(() => presetToDates('this_month').from);
  const [filterTo, setFilterTo]       = useState(() => presetToDates('this_month').to);
  const [customFrom, setCustomFrom]   = useState('');
  const [customTo, setCustomTo]       = useState('');
  const [showDateDrop, setShowDateDrop] = useState(false);
  const dateDropRef = useRef<HTMLDivElement>(null);

  // column manager
  const [visibleCols, setVisibleCols] = useState<ColKey[]>(() => {
    try { const s = localStorage.getItem(COL_STORAGE_KEY + '-vis'); if (s) return JSON.parse(s); } catch { /**/ }
    return DEFAULT_VISIBLE;
  });
  const [colOrder, setColOrder] = useState<ColKey[]>(() => {
    try { const s = localStorage.getItem(COL_STORAGE_KEY + '-ord'); if (s) return JSON.parse(s); } catch { /**/ }
    return ALL_COLUMNS.map(c => c.key);
  });
  const [showColModal, setShowColModal] = useState(false);
  const [dragKey, setDragKey]         = useState<ColKey | null>(null);
  const [dragOverKey, setDragOverKey] = useState<ColKey | null>(null);

  const orderedVisible = colOrder.filter(k => visibleCols.includes(k));

  // ─ Load ─
  const load = useCallback(async (
    s = search, p = page, t = tab,
    fr = filterFrom, to = filterTo,
    lm = limit, sb = sortBy, so = sortOrder,
    br = filterBranch, rf = filterRefund, lt = filterLoaiTraHang,
  ) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, limit: lm, sortBy: sb, sortOrder: so };
      if (t)  params.status        = t;
      if (s)  params.search        = s;
      if (fr) params.dateFrom      = fr;
      if (to) params.dateTo        = to;
      if (br) params.branchId      = br;
      if (rf) params.refundStatus  = rf;
      if (lt) params.loaiTraHang   = lt;

      const [listRes, statsRes] = await Promise.all([
        getPurchaseReturns(params),
        getPurchaseReturnStats({ dateFrom: fr || undefined, dateTo: to || undefined, branchId: br || undefined }),
      ]);
      setRecords(listRes.data);
      setTotal(listRes.total);
      setTotalPages(listRes.totalPages);
      setStats(statsRes);
      setLoadError('');
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Không tải được dữ liệu');
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page, tab, filterFrom, filterTo, limit, sortBy, sortOrder, filterBranch, filterRefund, filterLoaiTraHang]);

  useEffect(() => { load(); }, []); // eslint-disable-line

  // load branches once
  useEffect(() => {
    branchesApi.getAll(true).then((data: Branch[]) => setBranches(data)).catch(() => {});
  }, []);

  // close date dropdown on outside click
  useEffect(() => {
    function h(e: MouseEvent) {
      if (dateDropRef.current && !dateDropRef.current.contains(e.target as Node)) setShowDateDrop(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ─ Handlers ─
  function handleSort(col: string) {
    const so = sortBy === col && sortOrder === 'DESC' ? 'ASC' : 'DESC';
    setSortBy(col); setSortOrder(so); setPage(1);
    load(search, 1, tab, filterFrom, filterTo, limit, col, so, filterBranch, filterRefund, filterLoaiTraHang);
  }

  function handlePage(p: number) {
    if (p < 1 || p > totalPages) return;
    setPage(p); load(search, p, tab, filterFrom, filterTo, limit, sortBy, sortOrder, filterBranch, filterRefund, filterLoaiTraHang);
  }

  function handleSearch(v: string) {
    setSearch(v); setPage(1);
    load(v, 1, tab, filterFrom, filterTo, limit, sortBy, sortOrder, filterBranch, filterRefund, filterLoaiTraHang);
  }

  function handleTab(t: string) {
    setTab(t); setPage(1);
    load(search, 1, t, filterFrom, filterTo, limit, sortBy, sortOrder, filterBranch, filterRefund, filterLoaiTraHang);
  }

  function handleBranch(br: string) {
    setFilterBranch(br); setPage(1);
    load(search, 1, tab, filterFrom, filterTo, limit, sortBy, sortOrder, br, filterRefund, filterLoaiTraHang);
  }

  function handleRefund(rf: string) {
    setFilterRefund(rf); setPage(1);
    load(search, 1, tab, filterFrom, filterTo, limit, sortBy, sortOrder, filterBranch, rf, filterLoaiTraHang);
  }

  function handleLoaiTraHang(lt: string) {
    setFilterLoaiTraHang(lt); setPage(1);
    load(search, 1, tab, filterFrom, filterTo, limit, sortBy, sortOrder, filterBranch, filterRefund, lt);
  }

  function applyDatePreset(key: string) {
    setFilterDatePreset(key);
    const { from, to } = presetToDates(key);
    setFilterFrom(from); setFilterTo(to); setShowDateDrop(false); setPage(1);
    load(search, 1, tab, from, to, limit, sortBy, sortOrder, filterBranch, filterRefund, filterLoaiTraHang);
  }

  function applyCustomDate() {
    setFilterDatePreset(''); setShowDateDrop(false); setPage(1);
    setFilterFrom(customFrom); setFilterTo(customTo);
    load(search, 1, tab, customFrom, customTo, limit, sortBy, sortOrder, filterBranch, filterRefund, filterLoaiTraHang);
  }

  function clearDate() {
    setFilterDatePreset(''); setFilterFrom(''); setFilterTo('');
    setCustomFrom(''); setCustomTo(''); setShowDateDrop(false); setPage(1);
    load(search, 1, tab, '', '', limit, sortBy, sortOrder, filterBranch, filterRefund, filterLoaiTraHang);
  }

  // column manager helpers
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
  const pageFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageTo   = Math.min(page * limit, total);

  // ─ Table header ─
  function renderHeader(key: ColKey) {
    const label    = ALL_COLUMNS.find(c => c.key === key)?.label ?? key;
    const sortable = ['createdAt', 'returnDate', 'totalAmountVnd'].includes(key);
    const alignR   = ['totalAmountVnd', 'itemCount'].includes(key);
    return (
      <th key={key}
        className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${alignR ? 'text-right' : 'text-left'} ${sortable ? 'cursor-pointer hover:text-gray-700' : ''}`}
        onClick={sortable ? () => handleSort(key) : undefined}>
        {label}{sortable && <SortIcon col={key} sortBy={sortBy} sortOrder={sortOrder} />}
      </th>
    );
  }

  // ─ Table cell ─
  function renderCell(key: ColKey, row: PurchaseReturn) {
    switch (key) {
      case 'returnDate':
        return <td key={key} className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(row.returnDate)}</td>;
      case 'supplier':
        return <td key={key} className="px-4 py-3"><div className="font-medium text-gray-800 truncate max-w-[180px]">{row.supplier?.name ?? <span className="text-gray-300">—</span>}</div></td>;
      case 'purchaseOrder':
        return (
          <td key={key} className="px-4 py-3" onClick={e => e.stopPropagation()}>
            {row.purchaseOrder
              ? <Link href={`/dashboard/don-hang-nhap/${row.purchaseOrder.id}`} className="font-mono text-xs text-blue-600 hover:underline">{row.purchaseOrder.code}</Link>
              : <span className="text-gray-300">—</span>}
          </td>
        );
      case 'itemCount':
        return <td key={key} className="px-4 py-3 text-right text-gray-700">{row.items?.length ?? 0} SP</td>;
      case 'totalAmountVnd':
        return <td key={key} className="px-4 py-3 text-right font-medium text-gray-800">{fmt(row.totalAmountVnd)}</td>;
      case 'status':
        return (
          <td key={key} className="px-4 py-3 text-center">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[row.status]}`}>
              {STATUS_LABEL[row.status]}
            </span>
          </td>
        );
      case 'branch':
        return <td key={key} className="px-4 py-3 text-sm text-gray-600">{row.branch?.name ?? <span className="text-gray-300">—</span>}</td>;
      case 'refundStatus': {
        const RS: Record<string, { label: string; cls: string }> = {
          none:    { label: 'Chưa hoàn',    cls: 'bg-gray-100 text-gray-500 border border-gray-200' },
          partial: { label: 'Một phần',     cls: 'bg-amber-50 text-amber-600 border border-amber-100' },
          full:    { label: 'Hoàn toàn bộ', cls: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
        };
        const rs = RS[row.refundStatus ?? 'none'] ?? RS.none;
        return (
          <td key={key} className="px-4 py-3 text-center">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${rs.cls}`}>{rs.label}</span>
          </td>
        );
      }
      case 'loaiTraHang': {
        const lth = row.loaiTraHang;
        return (
          <td key={key} className="px-4 py-3">
            {lth
              ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-100">{LOAI_TRA_HANG[lth]}</span>
              : <span className="text-gray-300">—</span>}
          </td>
        );
      }
      case 'reason':
        return <td key={key} className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">{row.reason ?? <span className="text-gray-300">—</span>}</td>;
      case 'actorName':
        return <td key={key} className="px-4 py-3 text-sm text-gray-500">{row.actorName ?? '—'}</td>;
      case 'createdAt':
        return <td key={key} className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">{fmtDate(row.createdAt)}</td>;
      default:
        return <td key={key} />;
    }
  }

  return (
    <div className="p-6 space-y-5 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trả Hàng NCC</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {filterFrom && filterTo
              ? `Đang xem: ${fmtDate(filterFrom)} – ${fmtDate(filterTo)}`
              : 'Quản lý phiếu trả hàng về nhà cung cấp sau khi nhận đơn nhập'}
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
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="flex-1 truncate">{filterDatePreset ? DATE_PRESETS.find(p => p.key === filterDatePreset)?.label ?? 'Tùy chọn' : 'Ngày tạo'}</span>
              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showDateDrop && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 p-3">
                <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-2 px-0.5">Lọc theo ngày tạo</p>
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  {DATE_PRESETS.map(p => (
                    <button key={p.key} onClick={() => applyDatePreset(p.key)}
                      className={`px-3 py-2 rounded-xl text-sm text-left font-medium transition ${filterDatePreset === p.key ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>
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

          <Link href="/dashboard/don-hang-nhap/tra-hang-ncc/tao"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tạo phiếu trả
          </Link>
        </div>
      </div>

      {/* KPI bar */}
      {stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {([
              {
                label: 'Tổng phiếu trả', value: stats.total.toLocaleString('vi-VN'),
                gradient: 'from-slate-600 to-slate-800', shadow: 'shadow-slate-200',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
              },
              {
                label: 'Nháp', value: stats.pending.toLocaleString('vi-VN'),
                gradient: 'from-amber-500 to-amber-700', shadow: 'shadow-amber-200',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
              },
              {
                label: 'Đã gửi NCC', value: stats.sent.toLocaleString('vi-VN'),
                gradient: 'from-blue-500 to-blue-700', shadow: 'shadow-blue-200',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />,
              },
              {
                label: 'Đã xác nhận', value: stats.confirmed.toLocaleString('vi-VN'),
                gradient: 'from-emerald-500 to-emerald-700', shadow: 'shadow-emerald-200',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
              },
              {
                label: 'Tổng giá trị trả', value: fmt(stats.totalValueVnd),
                gradient: 'from-red-500 to-red-700', shadow: 'shadow-red-200',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
              },
            ] as const).map(k => (
              <div key={k.label} className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${k.gradient} shadow-sm ${k.shadow} flex items-center gap-2.5 px-3.5 py-2.5`}>
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">{k.icon}</svg>
                </div>
                <div className="z-10 min-w-0">
                  <p className="text-[10px] text-white/60 font-medium leading-none">{k.label}</p>
                  <p className="text-sm font-bold text-white mt-0.5 leading-tight truncate">{k.value}</p>
                </div>
                <div className="absolute -right-3 -bottom-3 w-12 h-12 rounded-full bg-white/10" />
              </div>
            ))}
          </div>

          {/* Analytics — byLyDo + topSP */}
          {(Object.keys(stats.byLyDo ?? {}).length > 0 || (stats.topSP ?? []).length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {/* Breakdown theo loại trả */}
              {Object.keys(stats.byLyDo ?? {}).length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Phân loại trả hàng</p>
                  <div className="space-y-2">
                    {Object.entries(stats.byLyDo).map(([k, v]) => {
                      const total = Object.values(stats.byLyDo).reduce((a, b) => a + b, 0);
                      const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                      const label = LOAI_TRA_HANG[k as LoaiTraHang] ?? k;
                      return (
                        <div key={k}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-600">{label}</span>
                            <span className="font-medium text-gray-700">{fmt(v)} <span className="text-gray-400">({pct}%)</span></span>
                          </div>
                          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full bg-orange-400 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top SP trả nhiều nhất */}
              {(stats.topSP ?? []).length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">SP trả nhiều nhất (kỳ này)</p>
                  <div className="space-y-2">
                    {stats.topSP.map((sp, i) => (
                      <div key={sp.productId} className="flex items-center gap-3 text-sm">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${i === 0 ? 'bg-red-100 text-red-600' : i === 1 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate text-xs">{sp.productName}</p>
                          {sp.productCode && <p className="text-[10px] text-gray-400 font-mono">{sp.productCode}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-semibold text-gray-700">{Number(sp.tongSL).toLocaleString('vi-VN')} SP</p>
                          <p className="text-[10px] text-gray-400">{fmt(sp.tongGiaTri)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Table card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Status tabs */}
        <div className="flex items-center border-b border-gray-100 overflow-x-auto">
          {[
            { key: '',           label: 'Tất cả',       count: null },
            { key: 'draft',      label: 'Nháp',         count: stats?.pending },
            { key: 'sent',       label: 'Đã gửi NCC',   count: stats?.sent },
            { key: 'confirmed',  label: 'Đã xác nhận',  count: stats?.confirmed },
            { key: 'cancelled',  label: 'Đã huỷ',       count: stats?.cancelled },
          ].map(t => (
            <button key={t.key} onClick={() => handleTab(t.key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${tab === t.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
              {t.count != null && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 rounded-full px-1.5">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-wrap">
          {/* Gear — column manager */}
          <button onClick={() => setShowColModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 bg-white flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Chọn cột <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-medium">{orderedVisible.length}</span>
          </button>

          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => handleSearch(e.target.value)}
              placeholder="Tìm mã phiếu, NCC, đơn nhập..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-blue-400 bg-white" />
          </div>

          {/* Loai tra hang filter */}
          <select value={filterLoaiTraHang} onChange={e => handleLoaiTraHang(e.target.value)}
            className={`px-3 py-2 text-sm rounded-xl border transition bg-white ${filterLoaiTraHang ? 'border-orange-300 text-orange-700 bg-orange-50 font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <option value="">Loại trả</option>
            {(Object.entries(LOAI_TRA_HANG) as [LoaiTraHang, string][]).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          {/* Refund filter */}
          <select value={filterRefund} onChange={e => handleRefund(e.target.value)}
            className={`px-3 py-2 text-sm rounded-xl border transition bg-white ${filterRefund ? 'border-blue-300 text-blue-700 bg-blue-50 font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <option value="">Hoàn tiền</option>
            <option value="none">Chưa hoàn</option>
            <option value="partial">Một phần</option>
            <option value="full">Hoàn toàn bộ</option>
          </select>
        </div>

        {loadError && <div className="m-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{loadError}</div>}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr className="text-xs text-gray-500 font-medium">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 whitespace-nowrap"
                  onClick={() => handleSort('code')}>
                  Mã phiếu <SortIcon col="code" sortBy={sortBy} sortOrder={sortOrder} />
                </th>
                {orderedVisible.map(k => renderHeader(k))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={1 + orderedVisible.length} className="px-4 py-16 text-center text-gray-400 text-sm">Đang tải...</td></tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={1 + orderedVisible.length} className="px-4 py-16 text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-2xl mx-auto mb-3 flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <p className="text-gray-400 text-sm">Chưa có phiếu trả hàng nào</p>
                    <Link href="/dashboard/don-hang-nhap/tra-hang-ncc/tao"
                      className="mt-3 inline-flex items-center gap-1.5 text-blue-600 text-sm hover:underline">
                      Tạo phiếu trả đầu tiên →
                    </Link>
                  </td>
                </tr>
              ) : records.map(row => (
                <tr key={row.id}
                  className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/dashboard/don-hang-nhap/tra-hang-ncc/${row.id}`)}>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => router.push(`/dashboard/don-hang-nhap/tra-hang-ncc/${row.id}`)}
                      className="font-mono font-medium text-blue-600 hover:text-blue-700 hover:underline">
                      {row.code}
                    </button>
                    {row.actorName && !orderedVisible.includes('actorName') && (
                      <div className="text-xs text-gray-400 mt-0.5">{row.actorName}</div>
                    )}
                  </td>
                  {orderedVisible.map(k => renderCell(k, row))}
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
                <button key={n} onClick={() => { setLimit(n); setPage(1); load(search, 1, tab, filterFrom, filterTo, n, sortBy, sortOrder, filterBranch, filterRefund, filterLoaiTraHang); }}
                  className={`px-3 py-1.5 text-xs transition ${limit === n ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                  {n}
                </button>
              ))}
            </div>
            <span>
              Hiển thị {total === 0 ? '0' : `${pageFrom}–${pageTo}`} trên tổng{' '}
              <span className="font-semibold text-gray-600">{total}</span> phiếu
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
            <div className="grid grid-cols-2 divide-x divide-gray-100 min-h-[300px]">
              {/* Left: toggle */}
              <div className="p-5 overflow-y-auto max-h-[380px]">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Hiển thị / Ẩn</p>
                <div className="text-xs text-gray-400 mb-2 border-b pb-2 border-gray-100">Mã phiếu (cố định)</div>
                {ALL_COLUMNS.map(col => (
                  <label key={col.key} className="flex items-center gap-2 py-1.5 cursor-pointer hover:text-gray-700 text-sm text-gray-600">
                    <input type="checkbox" checked={visibleCols.includes(col.key)} onChange={() => toggleCol(col.key)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                    {col.label}
                  </label>
                ))}
              </div>
              {/* Right: drag reorder */}
              <div className="p-5 overflow-y-auto max-h-[380px]">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Thứ tự cột (kéo thả)</p>
                <div className="text-xs text-gray-400 mb-1 border-b pb-2 border-gray-100">Mã phiếu (đầu tiên)</div>
                {colOrder.map(key => {
                  const col = ALL_COLUMNS.find(c => c.key === key);
                  if (!col) return null;
                  return (
                    <div key={key} draggable
                      onDragStart={() => handleDragStart(key)}
                      onDragOver={e => handleDragOver(e, key)}
                      onDrop={() => handleDrop(key)}
                      className={`flex items-center gap-2 py-2 px-2 rounded-lg cursor-grab text-sm transition ${dragOverKey === key ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-600'} ${!visibleCols.includes(key) ? 'opacity-40' : ''}`}>
                      <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      {col.label}
                    </div>
                  );
                })}
                <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">(Thao tác — trong chi tiết)</div>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button onClick={() => saveColSettings(DEFAULT_VISIBLE, ALL_COLUMNS.map(c => c.key))}
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
