'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { transactionsApi, branchesApi, PM_LABEL } from '@/lib/transactions';
import { employeesApi } from '@/lib/employees';
import { fmtMoney, fmtDate } from '@/lib/utils';

interface Tx {
  id: number; code: string; type: 'receipt' | 'payment';
  amount: number; paymentMethod: string; category: string | null;
  note: string | null; date: string | null; createdAt: string;
  isDeleted: boolean;
  partner?: { id: number; name: string; code?: string } | null;
  branchEntity?: { id: number; name: string } | null;
  createdBy?: { id: number; fullName: string } | null;
  tags?: string | null;
}
interface LedgerRow extends Tx { balance: number; }

const PTTT_OPTIONS = [
  { value: '', label: 'Tất cả PTTT' },
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'bank_transfer', label: 'Chuyển khoản' },
  { value: 'momo', label: 'MoMo' },
  { value: 'other', label: 'Khác' },
];

const PM_COLOR: Record<string, string> = {
  cash: 'bg-green-100 text-green-700', bank_transfer: 'bg-blue-100 text-blue-700',
  momo: 'bg-pink-100 text-pink-700', other: 'bg-gray-100 text-gray-500',
};

/* ─── Column definitions ─────────────────────────────────────────── */
const ALL_COLUMNS = [
  { key: 'code',        label: 'Mã phiếu',      fixed: false },
  { key: 'type',        label: 'Loại',           fixed: false },
  { key: 'category',    label: 'Diễn giải',      fixed: false },
  { key: 'pttt',        label: 'PTTT',           fixed: false },
  { key: 'partner',     label: 'Đối tác',        fixed: false },
  { key: 'branch',      label: 'Chi nhánh',      fixed: false },
  { key: 'createdBy',   label: 'Người tạo',      fixed: false },
  { key: 'tags',        label: 'Tags',           fixed: false },
  { key: 'receipt',     label: 'Thu',            fixed: false },
  { key: 'payment',     label: 'Chi',            fixed: false },
];
const DEFAULT_VISIBLE = ['code', 'type', 'category', 'pttt', 'receipt', 'payment'];

const PAGE_SIZES = [20, 50, 100];

export default function SoQuyPage() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [pttt, setPttt] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [ptttBalance, setPtttBalance] = useState<Record<string, number>>({});
  const [openingBalance, setOpeningBalance] = useState(0);
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [createdById, setCreatedById] = useState('');
  const [employees, setEmployees] = useState<{ id: number; fullName: string }[]>([]);

  // date preset
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateMode, setDateMode] = useState<'custom' | string>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const datePickerRef = useRef<HTMLDivElement>(null);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // column settings
  const [visibleCols, setVisibleCols] = useState<string[]>(DEFAULT_VISIBLE);
  const [colOrder, setColOrder] = useState<string[]>(ALL_COLUMNS.map(c => c.key));
  const [showColModal, setShowColModal] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // tab filter + search
  const [typeFilter, setTypeFilter] = useState<'' | 'receipt' | 'payment'>('');
  const [search, setSearch] = useState('');

  useEffect(() => { branchesApi.getAll().then(r => setBranches(r.data || r || [])).catch(() => {}); }, []);
  useEffect(() => {
    employeesApi.getAll({ limit: '200' })
      .then(r => setEmployees(Array.isArray(r) ? r : (r.data ?? [])))
      .catch(() => {});
  }, []);

  // Close date picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function applyPreset(preset: string) {
    const today = new Date();
    // Format theo local timezone, tránh UTC shift (Vietnam UTC+7)
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    let from: Date, to: Date;
    switch (preset) {
      case 'today':     from = startOf(today); to = startOf(today); break;
      case 'yesterday': { const y = new Date(today); y.setDate(y.getDate()-1); from = startOf(y); to = startOf(y); break; }
      case '7days':     { const s = new Date(today); s.setDate(s.getDate()-6); from = startOf(s); to = startOf(today); break; }
      case '30days':    { const s = new Date(today); s.setDate(s.getDate()-29); from = startOf(s); to = startOf(today); break; }
      case 'thisMonth': from = new Date(today.getFullYear(), today.getMonth(), 1); to = startOf(today); break;
      case 'lastMonth': from = new Date(today.getFullYear(), today.getMonth()-1, 1); to = new Date(today.getFullYear(), today.getMonth(), 0); break;
      case 'thisYear':  from = new Date(today.getFullYear(), 0, 1); to = startOf(today); break;
      case 'lastYear':  from = new Date(today.getFullYear()-1, 0, 1); to = new Date(today.getFullYear()-1, 11, 31); break;
      default: return;
    }
    setDateFrom(fmt(from));
    setDateTo(fmt(to));
    setDateMode(preset);
    setShowDatePicker(false);
  }

  const PRESET_LABEL: Record<string, string> = {
    today: 'Hôm nay', yesterday: 'Hôm qua', '7days': '7 ngày qua', '30days': '30 ngày qua',
    thisMonth: 'Tháng này', lastMonth: 'Tháng trước', thisYear: 'Năm nay', lastYear: 'Năm trước',
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const LOAD_LIMIT = 10000;
      const params: Record<string, string> = { limit: String(LOAD_LIMIT), sortBy: 'date', sortOrder: 'ASC' };
      if (pttt) params.paymentMethod = pttt;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (branchId) params.branchId = branchId;
      if (createdById) params.createdById = createdById;

      const statsParams: Record<string, string> = {};
      if (branchId) statsParams.branchId = branchId;
      if (dateFrom) statsParams.dateFrom = dateFrom;

      const [txRes, statsRes] = await Promise.all([
        transactionsApi.getAll(params),
        transactionsApi.getStats(statsParams),
      ]);

      setPtttBalance(statsRes.ptttBalance || {});
      setOpeningBalance(Number(statsRes.openingBalance || 0));

      setTruncated((txRes.total ?? 0) > (txRes.data?.length ?? 0));

      let balance = Number(statsRes.openingBalance || 0);
      const ledger: LedgerRow[] = (txRes.data as Tx[]).map((tx: Tx) => {
        balance += tx.type === 'receipt' ? Number(tx.amount) : -Number(tx.amount);
        return { ...tx, balance };
      });
      setRows(ledger);
      setPage(1);
    } catch {}
    finally { setLoading(false); }
  }, [pttt, dateFrom, dateTo, branchId, createdById]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalReceipt = rows.reduce((s, r) => r.type === 'receipt' ? s + Number(r.amount) : s, 0);
  const totalPayment = rows.reduce((s, r) => r.type === 'payment' ? s + Number(r.amount) : s, 0);
  const endBalance = openingBalance + totalReceipt - totalPayment;

  const searchLower = search.toLowerCase().trim();
  const filteredRows = rows.filter(r => {
    if (typeFilter && r.type !== typeFilter) return false;
    if (searchLower) {
      const inCode = r.code.toLowerCase().includes(searchLower);
      const inCategory = r.category?.toLowerCase().includes(searchLower) ?? false;
      const inNote = r.note?.toLowerCase().includes(searchLower) ?? false;
      const inPartner = r.partner?.name.toLowerCase().includes(searchLower) ?? false;
      if (!inCode && !inCategory && !inNote && !inPartner) return false;
    }
    return true;
  });

  const filteredReceipt = filteredRows.reduce((s, r) => r.type === 'receipt' ? s + Number(r.amount) : s, 0);
  const filteredPayment = filteredRows.reduce((s, r) => r.type === 'payment' ? s + Number(r.amount) : s, 0);

  // Tính lại balance theo thứ tự ASC (chronological), sau đó đảo ngược để hiển thị mới nhất lên đầu
  // Tab "Tất cả": bắt đầu từ openingBalance → đúng ledger thực tế
  // Tab Phiếu thu/Phiếu chi / search: bắt đầu từ 0 → tổng lũy kế của loại đó
  const isFiltered = typeFilter !== '' || searchLower !== '';
  let _runBal = isFiltered ? 0 : openingBalance;
  const displayRows: LedgerRow[] = [...filteredRows].map(r => {
    _runBal += r.type === 'receipt' ? Number(r.amount) : -Number(r.amount);
    return { ...r, balance: _runBal };
  }).reverse(); // mới nhất lên đầu

  const totalPages = Math.max(1, Math.ceil(displayRows.length / pageSize));
  const pageRows = displayRows.slice((page - 1) * pageSize, page * pageSize);

  // ordered visible cols
  const orderedVisible = colOrder.filter(k => visibleCols.includes(k));

  /* ─── Column modal handlers ──────────────────────────────────────── */
  function toggleCol(key: string) {
    setVisibleCols(v => v.includes(key) ? v.filter(k => k !== key) : [...v, key]);
  }
  function resetCols() {
    setVisibleCols(DEFAULT_VISIBLE);
    setColOrder(ALL_COLUMNS.map(c => c.key));
  }

  function onDragStart(key: string) {
    setDragKey(key);
  }
  function onDragEnter(key: string) {
    if (key !== dragKey) setDragOverKey(key);
  }
  function onDrop(key: string) {
    if (!dragKey || dragKey === key) return;
    setColOrder(prev => {
      const next = [...prev];
      const from = next.indexOf(dragKey);
      const to = next.indexOf(key);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragKey);
      return next;
    });
    setDragKey(null);
    setDragOverKey(null);
  }
  function onDragEnd() {
    setDragKey(null);
    setDragOverKey(null);
  }

  function exportXlsx() {
    import('xlsx').then(XLSX => {
      const data = filteredRows.map((r, i) => ({
        'STT': i + 1,
        'Ngày ghi nhận': r.date ? r.date.slice(0, 10) : (r.createdAt ? r.createdAt.slice(0, 10) : ''),
        'Mã phiếu': r.code,
        'Loại': r.type === 'receipt' ? 'Phiếu thu' : 'Phiếu chi',
        'Diễn giải': r.category || '',
        'PTTT': PM_LABEL[r.paymentMethod] || r.paymentMethod,
        'Đối tác': r.partner?.name || '',
        'Người tạo': r.createdBy?.fullName || '',
        'Thu': r.type === 'receipt' ? Number(r.amount) : 0,
        'Chi': r.type === 'payment' ? Number(r.amount) : 0,
        'Số dư lũy kế': r.balance,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sổ quỹ');
      XLSX.writeFile(wb, `so-quy-${dateFrom}-${dateTo}.xlsx`);
    });
  }

  /* ─── Render cell ─────────────────────────────────────────────────── */
  function renderCell(col: string, row: LedgerRow) {
    switch (col) {
      case 'code':
        return (
          <td key={col} className="px-4 py-2.5 whitespace-nowrap">
            <Link href={`/dashboard/thu-chi/${row.type === 'receipt' ? 'phieu-thu' : 'phieu-chi'}/${row.id}`}
              className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline">
              {row.code}
            </Link>
          </td>
        );
      case 'type':
        return (
          <td key={col} className="px-4 py-2.5">
            {row.type === 'receipt'
              ? <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-lg">Thu</span>
              : <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-lg">Chi</span>}
          </td>
        );
      case 'category':
        return <td key={col} className="px-4 py-2.5 text-gray-500 max-w-48 truncate text-xs">{row.category || row.note || '—'}</td>;
      case 'pttt':
        return <td key={col} className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{PM_LABEL[row.paymentMethod] || row.paymentMethod}</td>;
      case 'partner':
        return <td key={col} className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{row.partner?.name || '—'}</td>;
      case 'branch':
        return <td key={col} className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{row.branchEntity?.name || '—'}</td>;
      case 'createdBy':
        return <td key={col} className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{row.createdBy?.fullName || '—'}</td>;
      case 'tags':
        return <td key={col} className="px-4 py-2.5 text-xs text-gray-400">{row.tags || '—'}</td>;
      case 'receipt':
        return (
          <td key={col} className="px-4 py-2.5 text-right text-xs font-semibold text-emerald-600 whitespace-nowrap">
            {row.type === 'receipt' ? fmtMoney(Number(row.amount)) : ''}
          </td>
        );
      case 'payment':
        return (
          <td key={col} className="px-4 py-2.5 text-right text-xs font-semibold text-red-500 whitespace-nowrap">
            {row.type === 'payment' ? fmtMoney(Number(row.amount)) : ''}
          </td>
        );
      default:
        return <td key={col} className="px-4 py-2.5">—</td>;
    }
  }

  function renderHeaderCell(col: string) {
    const label = ALL_COLUMNS.find(c => c.key === col)?.label || col;
    const alignRight = col === 'receipt' || col === 'payment';
    return (
      <th key={col} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${alignRight ? 'text-right' : 'text-left'}`}>
        {col === 'receipt' ? <span className="text-emerald-600">{label}</span>
          : col === 'payment' ? <span className="text-red-500">{label}</span>
          : label}
      </th>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Header */}
      <div className="px-6 py-3 bg-white border-b border-gray-100 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold text-gray-800">Sổ Quỹ</h1>
          <p className="text-xs text-gray-400">Lịch sử thu chi với số dư lũy kế</p>
        </div>

        {/* Date preset picker */}
        <div className="relative" ref={datePickerRef}>
          <button onClick={() => setShowDatePicker(v => !v)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span className="text-gray-600">
              {dateMode === 'custom'
                ? `${dateFrom} → ${dateTo}`
                : PRESET_LABEL[dateMode] || `${dateFrom} → ${dateTo}`}
            </span>
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>

          {showDatePicker && (
            <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 w-72">
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  ['today','Hôm nay'], ['yesterday','Hôm qua'],
                  ['7days','7 ngày qua'], ['30days','30 ngày qua'],
                  ['lastMonth','Tháng trước'], ['thisMonth','Tháng này'],
                  ['lastYear','Năm trước'], ['thisYear','Năm nay'],
                ].map(([key, label]) => (
                  <button key={key} onClick={() => applyPreset(key)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition ${dateMode === key ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className={`border-t border-gray-100 pt-3 ${dateMode === 'custom' ? '' : ''}`}>
                <button onClick={() => setDateMode('custom')}
                  className={`w-full px-3 py-1.5 text-xs rounded-lg border mb-2 transition ${dateMode === 'custom' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  Tùy chọn
                </button>
                {dateMode === 'custom' && (
                  <div className="flex items-center gap-2">
                    <input type="date" value={customFrom || dateFrom}
                      onChange={e => { setCustomFrom(e.target.value); setDateFrom(e.target.value); }}
                      className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <span className="text-gray-400 text-xs">→</span>
                    <input type="date" value={customTo || dateTo}
                      onChange={e => { setCustomTo(e.target.value); setDateTo(e.target.value); }}
                      className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* PTTT */}
        <select value={pttt} onChange={e => setPttt(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400">
          {PTTT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Chi nhánh */}
        <select value={branchId} onChange={e => setBranchId(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">Tất cả chi nhánh</option>
          {branches.map(b => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
        </select>

        {/* Người tạo */}
        <select value={createdById} onChange={e => setCreatedById(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">Tất cả người tạo</option>
          {employees.map(e => <option key={e.id} value={String(e.id)}>{e.fullName}</option>)}
        </select>
      </div>

      {/* Summary bar — SAPO style: label trên, số lớn dưới */}
      <div className="px-6 pt-3 pb-2">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-3 flex items-center">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 mb-0.5">Số dư đầu kỳ</p>
            <p className={`text-lg font-semibold ${openingBalance >= 0 ? 'text-gray-800' : 'text-orange-500'}`}>{fmtMoney(openingBalance)}</p>
          </div>
          <span className="text-gray-300 text-xl font-light px-4">+</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 mb-0.5">Tổng thu</p>
            <p className="text-lg font-semibold text-emerald-600">{fmtMoney(totalReceipt)}</p>
          </div>
          <span className="text-gray-300 text-xl font-light px-4">−</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 mb-0.5">Tổng chi</p>
            <p className="text-lg font-semibold text-red-500">{fmtMoney(totalPayment)}</p>
          </div>
          <span className="text-gray-300 text-xl font-light px-4">=</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 mb-0.5">Tồn cuối kỳ</p>
            <p className={`text-lg font-bold ${endBalance >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>{fmtMoney(endBalance)}</p>
          </div>
        </div>
      </div>

      {/* PTTT Balance Cards */}
      <div className="px-6 py-2 grid grid-cols-4 gap-3">
        {Object.entries(ptttBalance).map(([pm, bal]) => (
          <div key={pm} className="bg-white rounded-xl px-4 py-2.5 border border-gray-100 shadow-sm flex items-center justify-between">
            <span className={`px-2 py-0.5 text-xs font-medium rounded-lg ${PM_COLOR[pm] || 'bg-gray-100 text-gray-500'}`}>
              {PM_LABEL[pm] || pm}
            </span>
            <span className={`text-sm font-bold ${bal >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {fmtMoney(bal)}
            </span>
          </div>
        ))}
      </div>

      {/* Tabs + Search + Export */}
      <div className="px-6 pb-2 flex items-center justify-between gap-3">
        <div className="flex gap-1 border-b border-gray-200 w-fit shrink-0">
          {([['', 'Tất cả'], ['receipt', 'Phiếu thu'], ['payment', 'Phiếu chi']] as [string, string][]).map(([val, label]) => (
            <button key={val} onClick={() => { setTypeFilter(val as '' | 'receipt' | 'payment'); setPage(1); }}
              className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${typeFilter === val ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Tìm mã phiếu, diễn giải, đối tác..."
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button onClick={exportXlsx}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Xuất file
        </button>
      </div>

      {/* Ledger table */}
      <div className="flex-1 overflow-auto px-6 pb-6 flex flex-col gap-3">
        {truncated && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <span className="text-base">⚠️</span>
            <span>Dữ liệu vượt giới hạn hiển thị — số dư lũy kế có thể không chính xác. Hãy lọc theo khoảng thời gian hẹp hơn.</span>
          </div>
        )}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {/* Gear icon cell */}
                <th className="w-10 px-2 py-3">
                  <button onClick={() => setShowColModal(true)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition"
                    title="Tùy chỉnh cột hiển thị">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </th>
                {/* Fixed: Ngày ghi nhận */}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ngày ghi nhận</th>
                {/* Configurable columns */}
                {orderedVisible.map(col => renderHeaderCell(col))}
                {/* Fixed: Số dư lũy kế */}
                <th className="px-4 py-3 text-right text-xs font-semibold text-blue-600 uppercase tracking-wide">Số dư lũy kế</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: pageSize }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: orderedVisible.length + 3 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={orderedVisible.length + 3} className="py-16 text-center text-gray-400 text-sm">Chưa có giao dịch nào trong kỳ</td></tr>
              ) : (
                pageRows.map((row, idx) => (
                  <tr key={row.id} className={`border-b border-gray-50 hover:bg-gray-50 transition ${idx % 2 !== 0 ? 'bg-gray-50/30' : ''}`}>
                    <td className="w-10 px-2 py-2.5" />
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">{fmtDate(row.date || row.createdAt)}</td>
                    {orderedVisible.map(col => renderCell(col, row))}
                    <td className={`px-4 py-2.5 text-right text-xs font-bold whitespace-nowrap ${row.balance >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>
                      {fmtMoney(row.balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {isFiltered && (
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 italic">
              * Số dư lũy kế tính riêng theo loại phiếu, không tính số dư đầu kỳ.
            </div>
          )}
        </div>

        {/* Footer / Pagination */}
        <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-gray-100 rounded-2xl shadow-sm">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                {PAGE_SIZES.map(n => (
                  <button key={n} onClick={() => { setPageSize(n); setPage(1); }}
                    className={`px-2.5 py-1 text-xs font-medium transition border-r border-gray-200 last:border-r-0 ${pageSize === n ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                    {n}
                  </button>
                ))}
              </div>
              <span>kết quả</span>
            </div>
            <span className="text-gray-200">·</span>
            <span>
              {filteredRows.length === 0 ? '0' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredRows.length)}`}
              {' '}trên tổng <span className="font-semibold text-gray-600">{filteredRows.length}</span> giao dịch
            </span>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={page === 1} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs font-medium" title="Trang đầu">«</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs" title="Trang trước">‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                  acc.push(p); return acc;
                }, [])
                .map((item, idx) =>
                  item === 'ellipsis'
                    ? <span key={`e${idx}`} className="w-7 h-7 flex items-center justify-center text-gray-300 text-xs">…</span>
                    : <button key={item} onClick={() => setPage(item as number)}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition ${page === item ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>
                        {item}
                      </button>
                )}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs" title="Trang sau">›</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs font-medium" title="Trang cuối">»</button>
            </div>
          )}
        </div>
      </div>

      {/* Column Settings Modal */}
      {showColModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">Điều chỉnh cột hiển thị</h2>
              <button onClick={() => setShowColModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-2 divide-x divide-gray-100 min-h-[340px]">
              {/* Left: add columns */}
              <div className="p-5">
                <p className="text-sm font-semibold text-gray-600 mb-3">Thêm cột hiển thị</p>
                <div className="space-y-1">
                  {ALL_COLUMNS.map(col => (
                    <label key={col.key} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={visibleCols.includes(col.key)}
                        onChange={() => toggleCol(col.key)}
                        className="w-4 h-4 rounded border-gray-300 accent-blue-600" />
                      <span className="text-sm text-gray-700">{col.label}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400">
                  <p className="font-medium text-gray-500 mb-1">Cột cố định (luôn hiển thị)</p>
                  <p>• Ngày ghi nhận</p>
                  <p>• Số dư lũy kế</p>
                </div>
              </div>

              {/* Right: reorder visible columns */}
              <div className="p-5">
                <p className="text-sm font-semibold text-gray-600 mb-3">Cột hiển thị <span className="text-xs text-gray-400 font-normal">(kéo để sắp xếp)</span></p>
                <div className="space-y-1">
                  {/* Fixed top */}
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 opacity-60">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                      <span className="text-sm text-gray-600">Ngày ghi nhận</span>
                    </div>
                    <span className="text-xs text-gray-400">Cố định</span>
                  </div>

                  {colOrder.filter(k => visibleCols.includes(k)).map(key => {
                    const col = ALL_COLUMNS.find(c => c.key === key);
                    if (!col) return null;
                    return (
                      <div key={key}
                        draggable
                        onDragStart={() => onDragStart(key)}
                        onDragEnter={() => onDragEnter(key)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => onDrop(key)}
                        onDragEnd={onDragEnd}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl border cursor-grab active:cursor-grabbing transition
                          ${dragKey === key ? 'opacity-40 border-blue-300 bg-blue-50' : dragOverKey === key ? 'border-blue-400 bg-blue-50' : 'border-transparent hover:bg-gray-50'}`}>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                          <span className="text-sm text-gray-700">{col.label}</span>
                        </div>
                        <button onClick={() => toggleCol(key)} className="text-gray-300 hover:text-gray-500 transition">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    );
                  })}

                  {/* Fixed bottom */}
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 opacity-60">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                      <span className="text-sm text-blue-600">Số dư lũy kế</span>
                    </div>
                    <span className="text-xs text-gray-400">Cố định</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button onClick={resetCols} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-white transition">
                Quay về mặc định
              </button>
              <div className="flex gap-2">
                <button onClick={() => setShowColModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-white transition">
                  Thoát
                </button>
                <button onClick={() => setShowColModal(false)} className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition">
                  Lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
