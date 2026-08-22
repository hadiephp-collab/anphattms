'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { inventoryApi } from '@/lib/inventory';
import { localDateStr } from '@/lib/utils';

interface StockCountRow {
  id: number; code: string; status: 'counting' | 'balanced';
  notes: string | null; createdAt: string; balancedAt: string | null;
  createdBy?: { fullName?: string; username: string } | null;
  balancedBy?: { fullName?: string; username: string } | null;
  checker?: { fullName?: string; username: string } | null;
  branch?: string | null;
  itemCount?: number; checkedCount?: number; diffCount?: number;
}

const STATUS_MAP = {
  counting: { label: 'Đang kiểm',  cls: 'bg-blue-100 text-blue-700'  },
  balanced: { label: 'Đã cân bằng', cls: 'bg-green-100 text-green-700' },
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const ALL_COLS = [
  { key: 'Trạng thái', label: 'Trạng thái',    defaultOn: true  },
  { key: 'Tổng SP',    label: 'Tổng SP',        defaultOn: true  },
  { key: 'Đã kiểm',   label: 'Đã kiểm',        defaultOn: true  },
  { key: 'Lệch',      label: 'Lệch',           defaultOn: true  },
  { key: 'Chi nhánh', label: 'Chi nhánh',      defaultOn: false },
  { key: 'NV kiểm',   label: 'NV kiểm',        defaultOn: false },
  { key: 'Ngày tạo',  label: 'Ngày tạo',       defaultOn: true  },
  { key: 'Ngày CB',   label: 'Ngày cân bằng',  defaultOn: true  },
  { key: 'NV tạo',   label: 'Nhân viên tạo',  defaultOn: true  },
  { key: 'NV CB',    label: 'NV cân bằng',    defaultOn: false },
  { key: 'Ghi chú',  label: 'Ghi chú',        defaultOn: true  },
] as const;
type ColKey = typeof ALL_COLS[number]['key'];
const defaultVisibility = Object.fromEntries(ALL_COLS.map(c => [c.key, c.defaultOn])) as Record<ColKey, boolean>;

interface ImportRow { code: string; name: string; unit: string; actualQty: number | null; }


export default function StockCountsPage() {
  const router = useRouter();

  /* ── data ── */
  const [rows, setRows]             = useState<StockCountRow[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit]           = useState<20 | 50 | 100>(20);
  const [loading, setLoading]       = useState(true);
  const [stats, setStats]           = useState({ total: 0, counting: 0, balanced: 0 });

  /* ── filters ── */
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('');
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');
  const [branchFilter, setBranch] = useState('');

  /* ── bulk select ── */
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  /* ── column visibility ── */
  const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>(() => {
    try {
      const saved = localStorage.getItem('stock_counts_cols');
      return saved ? { ...defaultVisibility, ...JSON.parse(saved) } : defaultVisibility;
    } catch { return defaultVisibility; }
  });
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  /* ── date picker dropdown ── */
  const [showDatePicker, setShowDatePicker]   = useState(false);
  const [datePreset, setDatePreset]           = useState('');
  const [customDateFrom, setCustomDateFrom]   = useState('');
  const [customDateTo, setCustomDateTo]       = useState('');
  const datePickerRef = useRef<HTMLDivElement>(null);

  /* ── create / import ── */
  const [creating, setCreating]       = useState(false);
  const [showImport, setShowImport]   = useState(false);
  const [importRows, setImportRows]   = useState<ImportRow[]>([]);
  const [importFile, setImportFile]   = useState<string>('');
  const [importing, setImporting]     = useState(false);
  const [importError, setImportError] = useState('');

  /* ── click-outside for menus ── */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false);
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) setShowDatePicker(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── load ── */
  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p), limit: String(limit) };
      if (search)       params.search   = search;
      if (statusFilter) params.status   = statusFilter;
      if (dateFrom)     params.dateFrom = dateFrom;
      if (dateTo)       params.dateTo   = dateTo;
      if (branchFilter) params.branch   = branchFilter;
      const statsParams: Record<string, string> = {};
      if (search)       statsParams.search   = search;
      if (dateFrom)     statsParams.dateFrom = dateFrom;
      if (dateTo)       statsParams.dateTo   = dateTo;
      if (branchFilter) statsParams.branch   = branchFilter;
      const [res, s] = await Promise.all([
        inventoryApi.listStockCounts(params),
        inventoryApi.getStockCountStats(statsParams),
      ]);
      setRows(res.data ?? []);
      setTotal(res.total ?? 0);
      setTotalPages(res.totalPages ?? 1);
      setStats(s);
      setSelectedIds(new Set());
    } catch {}
    setLoading(false);
  }, [search, statusFilter, dateFrom, dateTo, branchFilter, limit]);

  useEffect(() => { load(page); }, [load, page]);

  /* ── create ── */
  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    try {
      const sc = await inventoryApi.createStockCount({});
      router.push(`/dashboard/inventory/stock-counts/${sc.id}`);
    } catch (e: any) { alert(e.message); setCreating(false); }
  }

  /* ── bulk select ── */
  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    if (selectedIds.size === rows.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(rows.map(r => r.id)));
  }
  async function handleBulkDelete() {
    if (!confirm(`Xóa ${selectedIds.size} phiếu kiểm đã chọn? Hành động không thể hoàn tác.`)) return;
    await Promise.all([...selectedIds].map(id => inventoryApi.deleteStockCount(id)));
    load(1); setPage(1);
  }

  /* ── column visibility ── */
  function toggleCol(key: ColKey) {
    setVisibleCols(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem('stock_counts_cols', JSON.stringify(next)); } catch {}
      return next;
    });
  }
  function resetCols() {
    setVisibleCols(defaultVisibility);
    try { localStorage.removeItem('stock_counts_cols'); } catch {}
  }

  /* ── export Excel ── */
  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const header = ['Mã phiếu', 'Trạng thái', 'Tổng SP', 'Đã kiểm', 'Lệch', 'Chi nhánh',
      'NV kiểm', 'Ngày tạo', 'Ngày cân bằng', 'Nhân viên tạo', 'NV cân bằng', 'Ghi chú'];
    const data = rows.map(r => [
      r.code,
      STATUS_MAP[r.status]?.label ?? r.status,
      r.itemCount ?? 0,
      r.checkedCount ?? 0,
      r.diffCount ?? 0,
      r.branch ?? '',
      r.checker?.fullName ?? r.checker?.username ?? '',
      fmtDate(r.createdAt),
      r.balancedAt ? fmtDate(r.balancedAt) : '',
      r.createdBy?.fullName ?? r.createdBy?.username ?? '',
      r.balancedBy?.fullName ?? r.balancedBy?.username ?? '',
      r.notes ?? '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    ws['!cols'] = header.map((h, i) => ({ wch: [12, 14, 8, 8, 6, 14, 14, 18, 18, 16, 16, 24][i] }));
    XLSX.utils.book_append_sheet(wb, ws, 'Kiểm hàng');
    XLSX.writeFile(wb, `kiem-hang-${localDateStr()}.xlsx`);
  }

  /* ── download template ── */
  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Mã SP', 'Tên SP', 'ĐVT', 'SL thực tế'],
      ['SP001', 'Ví dụ sản phẩm 1', 'Cái', 10],
      ['SP002', 'Ví dụ sản phẩm 2', 'Hộp', 5],
    ]);
    ws['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 10 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'mau-nhap-kiem-hang.xlsx');
  }

  /* ── parse import file ── */
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file.name);
    setImportError('');
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        // skip header row
        const parsed: ImportRow[] = raw.slice(1)
          .filter(row => row[0])
          .map(row => ({
            code:      String(row[0] ?? '').trim(),
            name:      String(row[1] ?? '').trim(),
            unit:      String(row[2] ?? '').trim(),
            actualQty: row[3] !== undefined && row[3] !== '' ? Number(row[3]) : null,
          }));
        if (!parsed.length) { setImportError('File không có dữ liệu hợp lệ.'); return; }
        setImportRows(parsed);
      } catch { setImportError('Không đọc được file. Hãy dùng file .xlsx đúng định dạng.'); }
    };
    reader.readAsBinaryString(file);
  }

  async function handleImportConfirm() {
    if (!importRows.length || importing) return;
    setImporting(true);
    try {
      const res = await inventoryApi.importStockCount(
        importRows.map(r => ({ code: r.code, actualQty: r.actualQty }))
      );
      setShowImport(false);
      setImportRows([]);
      setImportFile('');
      if (res.skipped?.length) {
        alert(`Tạo phiếu thành công!\nKhông tìm thấy ${res.skipped.length} mã SP: ${res.skipped.join(', ')}`);
      }
      router.push(`/dashboard/inventory/stock-counts/${res.id}`);
    } catch (e: any) { setImportError(e.message ?? 'Lỗi khi nhập file'); }
    setImporting(false);
  }

  /* ── date preset helpers ── */
  const DATE_PRESETS = [
    { key: 'today',      label: 'Hôm nay' },
    { key: 'yesterday',  label: 'Hôm qua' },
    { key: 'last-week',  label: 'Tuần trước' },
    { key: 'this-week',  label: 'Tuần này' },
    { key: 'last-month', label: 'Tháng trước' },
    { key: 'this-month', label: 'Tháng này' },
    { key: 'custom',     label: 'Tùy chọn' },
  ] as const;

  function presetLabel() {
    if (!dateFrom && !dateTo) return 'Ngày tạo';
    const found = DATE_PRESETS.find(p => p.key === datePreset);
    if (found && datePreset !== 'custom') return found.label;
    const fmt = (s: string) => s.split('-').reverse().join('/');
    if (dateFrom && dateTo) return `${fmt(dateFrom)} – ${fmt(dateTo)}`;
    if (dateFrom) return `Từ ${fmt(dateFrom)}`;
    return `Đến ${fmt(dateTo)}`;
  }

  function applyPreset(key: string) {
    const now = new Date();
    const toISO = localDateStr;
    if (key === 'today') {
      const t = toISO(now);
      setDateFrom(t); setDateTo(t);
    } else if (key === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      const t = toISO(y);
      setDateFrom(t); setDateTo(t);
    } else if (key === 'this-week') {
      const day = now.getDay() || 7;
      const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
      setDateFrom(toISO(mon)); setDateTo(toISO(now));
    } else if (key === 'last-week') {
      const day = now.getDay() || 7;
      const mon = new Date(now); mon.setDate(now.getDate() - day - 6);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      setDateFrom(toISO(mon)); setDateTo(toISO(sun));
    } else if (key === 'this-month') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateFrom(toISO(from)); setDateTo(toISO(now));
    } else if (key === 'last-month') {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to   = new Date(now.getFullYear(), now.getMonth(), 0);
      setDateFrom(toISO(from)); setDateTo(toISO(to));
    }
    setDatePreset(key);
    if (key !== 'custom') { setPage(1); setShowDatePicker(false); }
  }

  function applyCustomDate() {
    setPage(1); setShowDatePicker(false);
  }

  function clearDate() {
    setDateFrom(''); setDateTo(''); setDatePreset(''); setPage(1); setShowDatePicker(false);
  }

  const visibleColCount = 2 + ALL_COLS.filter(c => visibleCols[c.key]).length; // checkbox + code + visible cols

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-7 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-gray-900 tracking-tight">Kiểm hàng</h1>
          <p className="text-gray-400 text-xs mt-0.5">Quản lý phiếu kiểm kho và cân bằng tồn kho</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel}
            className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 active:scale-95 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Xuất file
          </button>
          <button onClick={() => { setShowImport(true); setImportRows([]); setImportFile(''); setImportError(''); }}
            className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 active:scale-95 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
            </svg>
            Nhập file
          </button>
          <button onClick={handleCreate} disabled={creating}
            className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-sm shadow-blue-200 disabled:opacity-60">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            {creating ? 'Đang tạo...' : 'Tạo phiếu kiểm'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5 space-y-3">

        {/* ── Status chips với badge số theo filter hiện tại ── */}
        <div className="flex items-center gap-2">
          {[
            { value: '',         label: 'Tất cả',     count: stats.total    },
            { value: 'counting', label: 'Đang kiểm',  count: stats.counting },
            { value: 'balanced', label: 'Đã cân bằng', count: stats.balanced },
          ].map(opt => {
            const active = statusFilter === opt.value;
            return (
              <button key={opt.value} onClick={() => { setStatus(opt.value); setPage(1); }}
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                  active ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}>
                {opt.label}
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none ${
                  active ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Filter bar ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
          {/* Gear icon — column chooser (left-most, consistent with other modules) */}
          <div ref={colMenuRef} className="relative flex-shrink-0">
            <button onClick={() => setShowColMenu(v => !v)}
              className={`p-2 rounded-lg border transition ${showColMenu ? 'bg-blue-50 border-blue-300 text-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              title="Chọn cột hiển thị">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {showColMenu && (
              <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-2">
                <p className="text-[11px] font-semibold text-gray-400 uppercase px-2 mb-2 tracking-wide">Cột hiển thị</p>
                {ALL_COLS.map(col => (
                  <label key={col.key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={visibleCols[col.key]} onChange={() => toggleCol(col.key)}
                      className="w-3.5 h-3.5 accent-blue-600 rounded" />
                    <span className="text-sm text-gray-700">{col.label}</span>
                  </label>
                ))}
                <div className="border-t border-gray-100 mt-2 pt-2 px-2">
                  <button onClick={resetCols} className="text-xs text-gray-400 hover:text-gray-600">Đặt lại mặc định</button>
                </div>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Tìm mã phiếu, ghi chú..."
              className="flex-1 text-sm outline-none bg-transparent text-gray-700 placeholder-gray-400" />
            {search && (
              <button onClick={() => { setSearch(''); setPage(1); }} className="text-gray-300 hover:text-gray-500">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          {/* Date picker — Sapo style dropdown */}
          <div ref={datePickerRef} className="relative">
            <button onClick={() => setShowDatePicker(v => !v)}
              className={`inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition ${
                (dateFrom || dateTo) ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}>
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="max-w-[160px] truncate">{presetLabel()}</span>
              <svg className={`w-3 h-3 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {(dateFrom || dateTo) && (
                <span onClick={e => { e.stopPropagation(); clearDate(); }}
                  className="ml-0.5 text-blue-400 hover:text-blue-600">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </span>
              )}
            </button>

            {showDatePicker && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 w-64 p-3">
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  {DATE_PRESETS.filter(p => p.key !== 'custom').map(p => (
                    <button key={p.key} onClick={() => applyPreset(p.key)}
                      className={`text-sm py-1.5 px-2 rounded-lg text-center font-medium transition ${
                        datePreset === p.key ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-700'
                      }`}>
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Custom range */}
                <button onClick={() => { setDatePreset('custom'); setCustomDateFrom(dateFrom); setCustomDateTo(dateTo); }}
                  className={`w-full text-sm py-1.5 px-2 rounded-lg text-center font-medium transition mb-3 ${
                    datePreset === 'custom' ? 'bg-blue-600 text-white' : 'bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-700'
                  }`}>
                  Tùy chọn
                </button>

                {datePreset === 'custom' && (
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 w-6">Từ</label>
                      <input type="date" value={customDateFrom} onChange={e => setCustomDateFrom(e.target.value)}
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 w-6">Đến</label>
                      <input type="date" value={customDateTo} onChange={e => setCustomDateTo(e.target.value)}
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                    </div>
                  </div>
                )}

                <button onClick={() => {
                    if (datePreset === 'custom') { setDateFrom(customDateFrom); setDateTo(customDateTo); }
                    setPage(1); setShowDatePicker(false);
                  }}
                  className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition">
                  Lọc
                </button>
              </div>
            )}
          </div>

          {/* Branch */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 min-w-[130px]">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
            </svg>
            <input value={branchFilter} onChange={e => { setBranch(e.target.value); setPage(1); }}
              placeholder="Chi nhánh..."
              className="flex-1 text-sm outline-none bg-transparent text-gray-700 placeholder-gray-400" />
            {branchFilter && (
              <button onClick={() => { setBranch(''); setPage(1); }} className="text-gray-300 hover:text-gray-500">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          {/* Clear all filters */}
          {(search || dateFrom || dateTo || branchFilter) && (
            <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setDatePreset(''); setBranch(''); setPage(1); }}
              className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition whitespace-nowrap">
              Xóa bộ lọc
            </button>
          )}
        </div>

        {/* ── Bulk action bar ── */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <span className="text-sm font-medium text-blue-700">Đã chọn {selectedIds.size} phiếu</span>
            <button onClick={handleBulkDelete}
              className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 bg-white border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Xóa đã chọn
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-blue-500 hover:text-blue-700">Bỏ chọn</button>
          </div>
        )}

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-gray-400 text-sm">Đang tải...</div>
          ) : rows.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm">Chưa có phiếu kiểm hàng nào</p>
              <button onClick={handleCreate} disabled={creating}
                className="mt-3 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition disabled:opacity-60">
                {creating ? 'Đang tạo...' : '+ Tạo phiếu kiểm đầu tiên'}
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {/* Checkbox all */}
                      <th className="px-4 py-3 w-10">
                        <input type="checkbox"
                          checked={rows.length > 0 && selectedIds.size === rows.length}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Mã phiếu</th>
                      {visibleCols['Trạng thái'] && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Trạng thái</th>}
                      {visibleCols['Tổng SP']    && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Tổng SP</th>}
                      {visibleCols['Đã kiểm']   && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Đã kiểm</th>}
                      {visibleCols['Lệch']      && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Lệch</th>}
                      {visibleCols['Chi nhánh'] && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Chi nhánh</th>}
                      {visibleCols['NV kiểm']   && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">NV kiểm</th>}
                      {visibleCols['Ngày tạo']  && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ngày tạo</th>}
                      {visibleCols['Ngày CB']   && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ngày cân bằng</th>}
                      {visibleCols['NV tạo']   && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nhân viên tạo</th>}
                      {visibleCols['NV CB']    && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">NV cân bằng</th>}
                      {visibleCols['Ghi chú']  && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ghi chú</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map(sc => {
                      const st = STATUS_MAP[sc.status] ?? { label: sc.status, cls: 'bg-gray-100 text-gray-600' };
                      const isSelected = selectedIds.has(sc.id);
                      return (
                        <tr key={sc.id} className={`hover:bg-gray-50/50 transition ${isSelected ? 'bg-blue-50/40' : ''}`}>
                          <td className="px-4 py-3">
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(sc.id)}
                              className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
                          </td>
                          <td className="px-4 py-3">
                            <Link href={`/dashboard/inventory/stock-counts/${sc.id}`}
                              className="font-semibold text-blue-600 hover:text-blue-800 hover:underline font-mono text-xs">
                              {sc.code}
                            </Link>
                          </td>
                          {visibleCols['Trạng thái'] && (
                            <td className="px-4 py-3">
                              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                            </td>
                          )}
                          {visibleCols['Tổng SP']    && <td className="px-4 py-3 text-right font-medium text-gray-700">{sc.itemCount ?? 0}</td>}
                          {visibleCols['Đã kiểm']   && <td className="px-4 py-3 text-right text-blue-600 font-medium">{sc.checkedCount ?? 0}</td>}
                          {visibleCols['Lệch']      && (
                            <td className="px-4 py-3 text-right">
                              {(sc.diffCount ?? 0) > 0
                                ? <span className="font-bold text-red-500">{sc.diffCount}</span>
                                : <span className="text-gray-400">0</span>}
                            </td>
                          )}
                          {visibleCols['Chi nhánh'] && <td className="px-4 py-3 text-gray-600 text-xs">{sc.branch ?? <span className="text-gray-300">—</span>}</td>}
                          {visibleCols['NV kiểm']   && <td className="px-4 py-3 text-gray-600 text-xs">{sc.checker?.fullName ?? sc.checker?.username ?? <span className="text-gray-300">—</span>}</td>}
                          {visibleCols['Ngày tạo']  && <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(sc.createdAt)}</td>}
                          {visibleCols['Ngày CB']   && <td className="px-4 py-3 text-gray-600 text-xs">{sc.balancedAt ? fmtDate(sc.balancedAt) : <span className="text-gray-300">—</span>}</td>}
                          {visibleCols['NV tạo']   && <td className="px-4 py-3 text-gray-600 text-xs">{sc.createdBy?.fullName ?? sc.createdBy?.username ?? <span className="text-gray-300">—</span>}</td>}
                          {visibleCols['NV CB']    && <td className="px-4 py-3 text-gray-600 text-xs">{sc.balancedBy?.fullName ?? sc.balancedBy?.username ?? <span className="text-gray-300">—</span>}</td>}
                          {visibleCols['Ghi chú']  && <td className="px-4 py-3 text-gray-400 max-w-[160px] truncate text-xs">{sc.notes ?? '—'}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
                {/* Left: limit picker + count */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>Hiển thị</span>
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                      {([20, 50, 100] as const).map(n => (
                        <button key={n} onClick={() => { setLimit(n); setPage(1); }}
                          className={`px-2.5 py-1 text-xs font-medium transition border-r border-gray-200 last:border-r-0 ${
                            limit === n ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
                          }`}>
                          {n}
                        </button>
                      ))}
                    </div>
                    <span>kết quả</span>
                  </div>
                  <span className="text-gray-200">·</span>
                  <span className="text-xs text-gray-400">
                    {total === 0 ? '0' : `${(page - 1) * limit + 1}–${Math.min(page * limit, total)}`}
                    {' '}trên tổng <span className="font-semibold text-gray-600">{total}</span> phiếu
                  </span>
                </div>

                {/* Right: page buttons */}
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
                              className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition ${
                                page === item ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
                              }`}>{item}</button>
                      )}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs"
                      title="Trang sau">›</button>
                    <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs font-medium"
                      title="Trang cuối">»</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Import Modal ── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Nhập file kiểm hàng</h2>
                <p className="text-xs text-gray-400 mt-0.5">Tải lên file Excel để tạo phiếu kiểm từ dữ liệu có sẵn</p>
              </div>
              <button onClick={() => setShowImport(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
              {/* Step 1 - template */}
              <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-600">1</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-800">Tải file mẫu</p>
                  <p className="text-xs text-blue-600 mt-0.5">File Excel cần có các cột: Mã SP, Tên SP, ĐVT, SL thực tế</p>
                  <button onClick={downloadTemplate}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 border border-blue-300 bg-white px-3 py-1.5 rounded-lg hover:bg-blue-50 transition">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Tải file mẫu (.xlsx)
                  </button>
                </div>
              </div>

              {/* Step 2 - upload */}
              <div className="bg-gray-50 rounded-xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-gray-600">2</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">Chọn file để nhập</p>
                  <label className="mt-2 flex items-center gap-2 cursor-pointer group">
                    <div className="flex-1 border-2 border-dashed border-gray-300 group-hover:border-blue-400 rounded-xl p-4 text-center transition">
                      {importFile ? (
                        <div className="flex items-center justify-center gap-2 text-green-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm font-medium">{importFile}</span>
                        </div>
                      ) : (
                        <div className="text-gray-400">
                          <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="text-sm">Kéo thả hoặc <span className="text-blue-500">chọn file</span></p>
                          <p className="text-xs mt-1">.xlsx, .xls</p>
                        </div>
                      )}
                    </div>
                    <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
                  </label>
                  {importError && <p className="mt-2 text-xs text-red-500">{importError}</p>}
                </div>
              </div>

              {/* Preview */}
              {importRows.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Xem trước — {importRows.length} dòng
                  </p>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Mã SP</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Tên SP</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">ĐVT</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500">SL thực tế</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {importRows.slice(0, 10).map((r, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-mono text-blue-600">{r.code}</td>
                            <td className="px-3 py-2 text-gray-700">{r.name || <span className="text-gray-300">—</span>}</td>
                            <td className="px-3 py-2 text-gray-500">{r.unit || '—'}</td>
                            <td className="px-3 py-2 text-right font-medium">{r.actualQty ?? <span className="text-gray-300">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importRows.length > 10 && (
                      <div className="px-3 py-2 text-xs text-gray-400 text-center border-t border-gray-100">
                        ... và {importRows.length - 10} dòng khác
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
              <button onClick={() => setShowImport(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                Hủy
              </button>
              <button onClick={handleImportConfirm}
                disabled={!importRows.length || importing}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">
                {importing ? 'Đang xử lý...' : `Xác nhận nhập (${importRows.length} SP)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
