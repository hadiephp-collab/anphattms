'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { BAN_HANG_URL, laPhieuBanHang } from '@/lib/ban-hang';
import { transactionsApi, branchesApi, PM_LABEL } from '@/lib/transactions';
import { employeesApi } from '@/lib/employees';
import { fmtMoney, fmtDate, localDateStr } from '@/lib/utils';

interface Tx {
  id: number; code: string; type: 'receipt' | 'payment';
  amount: number; paymentMethod: string; category: string | null;
  note: string | null; date: string | null; createdAt: string;
  isDeleted: boolean;
  partner?: { id: number; name: string; code?: string } | null;
  /** 'ban_hang' = bản sao từ App Bán hàng (chỉ xem) */
  nguon?: string; doiTuongTen?: string | null; linkGoc?: string | null;
  branchEntity?: { id: number; name: string } | null;
  createdBy?: { id: number; fullName: string } | null;
  tags?: string | null;
}
interface LedgerRow extends Tx { balance: number; }

const PM_COLOR: Record<string, string> = {
  cash: 'bg-green-100 text-green-700',
  bank_transfer: 'bg-blue-100 text-blue-700',
  momo: 'bg-pink-100 text-pink-700',
  other: 'bg-gray-100 text-gray-500',
};
const PTTT_OPTIONS = [
  { value: '', label: 'Tất cả PTTT' }, { value: 'cash', label: 'Tiền mặt' },
  { value: 'bank_transfer', label: 'Chuyển khoản' }, { value: 'momo', label: 'MoMo' }, { value: 'other', label: 'Khác' },
];

/* ── Column definitions ── */
const ALL_COLS = [
  { key: 'code',       label: 'Mã phiếu',   shortLabel: 'Mã phiếu',   defaultOn: true  },
  { key: 'type',       label: 'Loại',        shortLabel: 'Loại',        defaultOn: true  },
  { key: 'category',   label: 'Diễn giải',   shortLabel: 'Diễn giải',   defaultOn: true  },
  { key: 'pttt',       label: 'PTTT',         shortLabel: 'PTTT',        defaultOn: true  },
  { key: 'receipt',    label: 'Thu',          shortLabel: 'Thu',         defaultOn: true  },
  { key: 'payment',    label: 'Chi',          shortLabel: 'Chi',         defaultOn: true  },
  { key: 'partner',    label: 'Đối tác',     shortLabel: 'Đối tác',    defaultOn: false },
  { key: 'branch',     label: 'Chi nhánh',   shortLabel: 'Chi nhánh',  defaultOn: false },
  { key: 'createdBy',  label: 'Người tạo',   shortLabel: 'Người tạo',  defaultOn: false },
  { key: 'tags',       label: 'Tags',         shortLabel: 'Tags',        defaultOn: false },
] as const;

type ColKey = typeof ALL_COLS[number]['key'];
const ALL_COL_KEYS = ALL_COLS.map(c => c.key) as ColKey[];
const defaultColVisibility = Object.fromEntries(ALL_COLS.map(c => [c.key, c.defaultOn])) as Record<ColKey, boolean>;
const colLabelMap = Object.fromEntries(ALL_COLS.map(c => [c.key, c.label])) as Record<ColKey, string>;
const colShortLabelMap = Object.fromEntries(ALL_COLS.map(c => [c.key, c.shortLabel])) as Record<ColKey, string>;
const RIGHT_COLS = new Set<ColKey>(['receipt', 'payment']);
const WRAP_TEXT_COLS = new Set<ColKey>(['category', 'partner', 'pttt', 'createdBy', 'branch', 'tags']);

const COL_WIDTHS_KEY = 'so_quy_col_widths_v1';
const ROW_HEIGHTS_KEY = 'so_quy_row_heights_v1';
const PINNED_KEY = 'so_quy_pinned_v1';
const WRAP_KEY = 'so_quy_wrap_v1';
const DEFAULT_ROW_H = 40;

const DEF_W: Record<string, number> = {
  date: 120, balance: 140,
  code: 130, type: 90, category: 200, pttt: 110, receipt: 130, payment: 130,
  partner: 150, branch: 120, createdBy: 120, tags: 130,
};

type WrapMode = 'truncate' | 'wrap2' | 'wrap';

/* ── Column config modal ── */
function SoQuyColModal({ visibleCols, colOrder, pinnedCount, wrapMode, onSave, onClose }: {
  visibleCols: Record<ColKey, boolean>;
  colOrder: ColKey[];
  pinnedCount: number;
  wrapMode: WrapMode;
  onSave(vc: Record<ColKey, boolean>, order: ColKey[], pinnedCount: number, wrap: WrapMode): void;
  onClose(): void;
}) {
  const [activeItems, setActiveItems] = useState<ColKey[]>(() => colOrder.filter(k => visibleCols[k]));
  const [localPinCount, setLocalPinCount] = useState<number>(pinnedCount);
  const [localWrap, setLocalWrap] = useState<WrapMode>(wrapMode);
  const [search, setSearch] = useState('');
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragSrc = useRef<number | null>(null);

  const inactiveKeys = ALL_COL_KEYS.filter(k => !activeItems.includes(k));
  const filteredInactive = search ? inactiveKeys.filter(k => colLabelMap[k].toLowerCase().includes(search.toLowerCase())) : inactiveKeys;

  function handleDragStart(e: React.DragEvent, idx: number) { dragSrc.current = idx; setDraggingIdx(idx); e.dataTransfer.effectAllowed = 'move'; }
  function handleDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIdx(idx); }
  function handleDrop(e: React.DragEvent, toIdx: number) {
    e.preventDefault();
    const fromIdx = dragSrc.current;
    if (fromIdx === null || fromIdx === toIdx) { setDragOverIdx(null); return; }
    setActiveItems(prev => { const next = [...prev]; const [item] = next.splice(fromIdx, 1); next.splice(toIdx, 0, item); return next; });
    dragSrc.current = null; setDraggingIdx(null); setDragOverIdx(null);
  }
  function handleDragEnd() { dragSrc.current = null; setDraggingIdx(null); setDragOverIdx(null); }

  function handleSave() {
    const newVisible = Object.fromEntries(ALL_COL_KEYS.map(k => [k, activeItems.includes(k)])) as Record<ColKey, boolean>;
    const newOrder = [...activeItems, ...ALL_COL_KEYS.filter(k => !activeItems.includes(k))] as ColKey[];
    onSave(newVisible, newOrder, localPinCount, localWrap);
    onClose();
  }
  function handleReset() { setActiveItems(ALL_COLS.filter(c => c.defaultOn).map(c => c.key) as ColKey[]); setLocalPinCount(0); setLocalWrap('truncate'); setSearch(''); }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '85vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-gray-800 text-base">Điều chỉnh cột hiển thị</h2>
            <p className="text-xs text-gray-400 mt-0.5">Cột cố định: <span className="text-blue-600">Ngày ghi nhận</span> và <span className="text-blue-600">Số dư lũy kế</span></p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-3 border-b border-gray-100 shrink-0 space-y-2.5">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0 w-32">Ghim cột đầu:</span>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              {([0, 1, 2, 3] as const).map(n => (
                <button key={n} onClick={() => setLocalPinCount(n)}
                  className={`px-3 py-1 text-xs font-medium transition border-r border-gray-200 last:border-r-0 ${localPinCount === n ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                  {n === 0 ? 'Không ghim' : `${n} cột`}
                </button>
              ))}
            </div>
            {localPinCount > 0 && (
              <span className="text-xs text-gray-400">({activeItems.slice(0, localPinCount).map(k => colShortLabelMap[k]).join(', ')})</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0 w-32">Hiển thị văn bản:</span>
            {([['truncate', 'Cắt ngắn'], ['wrap2', '2 dòng'], ['wrap', 'Toàn bộ']] as const).map(([v, lbl]) => (
              <button key={v} onClick={() => setLocalWrap(v)}
                className={`px-3 py-1 text-xs rounded-lg border transition ${localWrap === v ? 'bg-blue-50 border-blue-300 text-blue-600 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-4 px-6 py-5 flex-1 overflow-hidden min-h-0">
          <div className="flex-1 border border-gray-200 rounded-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 shrink-0 space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Thêm cột</p>
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm cột..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {filteredInactive.length === 0
                ? <p className="text-center text-gray-400 text-xs py-8">{search ? 'Không tìm thấy' : 'Tất cả cột đã hiển thị'}</p>
                : filteredInactive.map(key => (
                  <button key={key} onClick={() => setActiveItems(p => [...p, key])}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition text-left">
                    <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    {colLabelMap[key]}
                  </button>
                ))}
            </div>
          </div>
          <div className="flex-1 border border-gray-200 rounded-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cột hiển thị</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Kéo để sắp xếp thứ tự</p>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {activeItems.length === 0
                ? <p className="text-center text-gray-400 text-xs py-8">Chưa có cột nào</p>
                : activeItems.map((key, idx) => {
                  const isPinned = idx < localPinCount;
                  return (
                    <div key={key} draggable
                      onDragStart={e => handleDragStart(e, idx)} onDragOver={e => handleDragOver(e, idx)}
                      onDrop={e => handleDrop(e, idx)} onDragEnd={handleDragEnd}
                      className={['flex items-center gap-2 px-3 py-2.5 cursor-grab select-none transition',
                        draggingIdx === idx ? 'opacity-40 bg-gray-50' : '',
                        dragOverIdx === idx && draggingIdx !== idx ? 'bg-blue-50 border-t-2 border-blue-400' : isPinned ? 'bg-blue-50/50' : 'hover:bg-gray-50',
                      ].join(' ')}>
                      <svg className="w-4 h-4 text-gray-300 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="5.5" cy="4" r="1.2"/><circle cx="10.5" cy="4" r="1.2"/>
                        <circle cx="5.5" cy="8" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/>
                        <circle cx="5.5" cy="12" r="1.2"/><circle cx="10.5" cy="12" r="1.2"/>
                      </svg>
                      {isPinned && (
                        <svg className="w-3 h-3 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                      )}
                      <span className={`flex-1 text-sm ${isPinned ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>{colLabelMap[key]}</span>
                      <button onClick={() => setActiveItems(p => p.filter(k => k !== key))}
                        className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded transition shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-700 hover:underline">Quay về mặc định</button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Thoát</button>
            <button onClick={handleSave} className="px-5 py-2 text-sm font-semibold text-white rounded-xl transition bg-blue-600 hover:bg-blue-700">Lưu</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Cell content (no <td>) ── */
function soQuyCellContent(col: ColKey, row: LedgerRow): React.ReactNode {
  switch (col) {
    case 'code':
      return (
        <span className="inline-flex items-center gap-1.5">
          {laPhieuBanHang(row) && row.linkGoc && BAN_HANG_URL
            ? <a href={`${BAN_HANG_URL}${row.linkGoc}`} target="anphat-ban-hang" title="Phiếu từ App Bán hàng — bấm để mở phiếu gốc" className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap">{row.code}</a>
            : <Link href={`/dashboard/thu-chi/${row.type === 'receipt' ? 'phieu-thu' : 'phieu-chi'}/${row.id}`}
                className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap">
                {row.code}
              </Link>}
        </span>
      );
    case 'type':
      return row.type === 'receipt'
        ? <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-lg">Thu</span>
        : <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-lg">Chi</span>;
    case 'category':
      return <span className="text-gray-500">{row.category || row.note || '—'}</span>;
    case 'pttt':
      return <span className="text-gray-500">{PM_LABEL[row.paymentMethod] || row.paymentMethod}</span>;
    case 'partner':
      return row.partner
        ? <a href={`/dashboard/partners/${row.partner.id}`} className="text-blue-600 hover:underline">{row.partner.name}</a>
        : row.doiTuongTen ? <span className="text-gray-700">{row.doiTuongTen}</span> : <span className="text-gray-400">—</span>;
    case 'branch':
      return <span className="text-gray-500">{row.branchEntity?.name || '—'}</span>;
    case 'createdBy':
      return <span className="text-gray-600">{row.createdBy?.fullName || '—'}</span>;
    case 'tags':
      return row.tags ? (
        <div className="flex flex-wrap gap-1">
          {row.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
            <span key={t} className="px-1.5 py-0.5 text-[11px] bg-blue-50 text-blue-700 border border-blue-100 rounded-md">{t}</span>
          ))}
        </div>
      ) : <span className="text-gray-400">—</span>;
    case 'receipt':
      return row.type === 'receipt'
        ? <span className="font-semibold text-emerald-600 whitespace-nowrap">{fmtMoney(Number(row.amount))}</span>
        : <span className="text-gray-300">—</span>;
    case 'payment':
      return row.type === 'payment'
        ? <span className="font-semibold text-red-500 whitespace-nowrap">{fmtMoney(Number(row.amount))}</span>
        : <span className="text-gray-300">—</span>;
    default: return null;
  }
}

/* ── Main Page ── */
export default function SoQuyPage() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [pttt, setPttt] = useState('');
  /** '' tất cả · 'cong_ty' quỹ công ty (bỏ TK cá nhân) · 'ca_nhan' tiền ở TK cá nhân */
  const [quy, setQuy] = useState('cong_ty');
  const [ptttBalance, setPtttBalance] = useState<Record<string, number>>({});
  const [openingBalance, setOpeningBalance] = useState(0);
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [createdById, setCreatedById] = useState('');
  const [employees, setEmployees] = useState<{ id: number; fullName: string }[]>([]);
  const [typeFilter, setTypeFilter] = useState<'' | 'receipt' | 'payment'>('');
  const [search, setSearch] = useState('');
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [showColModal, setShowColModal] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 15 | 30 | 50 | 100>(30);
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  /* date preset */
  const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const localMonthStart = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; };
  const [dateMode, setDateMode] = useState<string>('thisMonth');
  const [dateFrom, setDateFrom] = useState(localMonthStart);
  const [dateTo, setDateTo] = useState(localToday);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const datePickerRef = useRef<HTMLDivElement>(null);

  /* Column config */
  const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>(() => {
    try { const s = localStorage.getItem('so_quy_cols'); if (s) return { ...defaultColVisibility, ...JSON.parse(s) }; } catch {}
    return defaultColVisibility;
  });
  const [colOrder, setColOrder] = useState<ColKey[]>(() => {
    try { const s = localStorage.getItem('so_quy_col_order'); if (s) { const p = JSON.parse(s) as ColKey[]; return [...p, ...ALL_COL_KEYS.filter(k => !p.includes(k))]; } } catch {}
    return ALL_COL_KEYS;
  });
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try { const s = localStorage.getItem(COL_WIDTHS_KEY); if (s) return JSON.parse(s); } catch {}
    return {};
  });
  const [rowHeights, setRowHeights] = useState<Record<number, number>>(() => {
    try { const s = localStorage.getItem(ROW_HEIGHTS_KEY); if (s) return JSON.parse(s); } catch {}
    return {};
  });
  const [pinnedCount, setPinnedCount] = useState<number>(() => {
    try { const s = localStorage.getItem(PINNED_KEY); if (s) return Math.min(3, parseInt(s) || 0); } catch {}
    return 0;
  });
  const [wrapMode, setWrapMode] = useState<WrapMode>(() => {
    try { const s = localStorage.getItem(WRAP_KEY); if (s && ['truncate','wrap2','wrap'].includes(s)) return s as WrapMode; } catch {}
    return 'truncate';
  });

  const orderedVisible = colOrder.filter(k => visibleCols[k]);

  function handleSaveColConfig(nv: Record<ColKey, boolean>, no: ColKey[], np: number, nw: WrapMode) {
    setVisibleCols(nv); setColOrder(no); setPinnedCount(np); setWrapMode(nw);
    try {
      localStorage.setItem('so_quy_cols', JSON.stringify(nv));
      localStorage.setItem('so_quy_col_order', JSON.stringify(no));
      localStorage.setItem(PINNED_KEY, String(np));
      localStorage.setItem(WRAP_KEY, nw);
    } catch {}
  }

  /* Column resize */
  const resizingCol = useRef<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);
  function onResizeMouseDown(e: React.MouseEvent, key: string) {
    e.preventDefault(); e.stopPropagation();
    resizingCol.current = key; resizeStartX.current = e.clientX;
    resizeStartW.current = colWidths[key] ?? DEF_W[key] ?? 120;
    const onMove = (ev: MouseEvent) => {
      if (!resizingCol.current) return;
      const nw = Math.max(60, resizeStartW.current + ev.clientX - resizeStartX.current);
      setColWidths(prev => { const n = { ...prev, [resizingCol.current!]: nw }; try { localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(n)); } catch {} return n; });
    };
    const onUp = () => { resizingCol.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  }

  /* Row resize */
  const rowResizingRef = useRef(false);
  const rowResizeId = useRef<number | null>(null);
  const rowResizeStartY = useRef(0);
  const rowResizeStartH = useRef(DEFAULT_ROW_H);
  function onRowResizeMouseDown(e: React.MouseEvent, id: number) {
    e.preventDefault(); rowResizingRef.current = true; rowResizeId.current = id;
    rowResizeStartY.current = e.clientY; rowResizeStartH.current = rowHeights[id] ?? DEFAULT_ROW_H;
    const onMove = (ev: MouseEvent) => {
      if (!rowResizingRef.current || rowResizeId.current === null) return;
      const nh = Math.max(28, rowResizeStartH.current + ev.clientY - rowResizeStartY.current);
      setRowHeights(prev => { const n = { ...prev, [rowResizeId.current!]: nh }; try { localStorage.setItem(ROW_HEIGHTS_KEY, JSON.stringify(n)); } catch {} return n; });
    };
    const onUp = () => { setTimeout(() => { rowResizingRef.current = false; }, 50); rowResizeId.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  }

  useEffect(() => { branchesApi.getAll().then(r => setBranches(r.data || r || [])).catch(() => {}); }, []);
  useEffect(() => { employeesApi.getAll({ limit: '200' }).then(r => setEmployees(Array.isArray(r) ? r : (r.data ?? []))).catch(() => {}); }, []);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) setShowDatePicker(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const PRESET_LABEL: Record<string, string> = {
    today: 'Hôm nay', yesterday: 'Hôm qua', '7days': '7 ngày qua', '30days': '30 ngày qua',
    thisMonth: 'Tháng này', lastMonth: 'Tháng trước', thisYear: 'Năm nay', lastYear: 'Năm trước',
  };
  function applyPreset(preset: string) {
    const today = new Date();
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
    setDateFrom(fmt(from)); setDateTo(fmt(to)); setDateMode(preset); setShowDatePicker(false);
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '10000', sortBy: 'date', sortOrder: 'ASC' };
      if (pttt) params.paymentMethod = pttt;
      if (quy) params.quy = quy;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (branchId) params.branchId = branchId;
      if (createdById) params.createdById = createdById;
      const statsParams: Record<string, string> = {};
      if (branchId) statsParams.branchId = branchId;
      if (quy) statsParams.quy = quy;
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
  }, [pttt, quy, dateFrom, dateTo, branchId, createdById]);
  useEffect(() => { loadData(); }, [loadData]);

  const totalReceipt = rows.reduce((s, r) => r.type === 'receipt' ? s + Number(r.amount) : s, 0);
  const totalPayment = rows.reduce((s, r) => r.type === 'payment' ? s + Number(r.amount) : s, 0);
  const endBalance = openingBalance + totalReceipt - totalPayment;

  const searchLower = search.toLowerCase().trim();
  const filteredRows = rows.filter(r => {
    if (typeFilter && r.type !== typeFilter) return false;
    if (searchLower) {
      const inCode = r.code.toLowerCase().includes(searchLower);
      const inCat = r.category?.toLowerCase().includes(searchLower) ?? false;
      const inNote = r.note?.toLowerCase().includes(searchLower) ?? false;
      const inPartner = (r.partner?.name ?? r.doiTuongTen ?? '').toLowerCase().includes(searchLower);
      if (!inCode && !inCat && !inNote && !inPartner) return false;
    }
    return true;
  });
  const filteredReceipt = filteredRows.reduce((s, r) => r.type === 'receipt' ? s + Number(r.amount) : s, 0);
  const filteredPayment = filteredRows.reduce((s, r) => r.type === 'payment' ? s + Number(r.amount) : s, 0);

  const isFiltered = typeFilter !== '' || searchLower !== '';
  let _runBal = isFiltered ? 0 : openingBalance;
  let displayRows: LedgerRow[] = [...filteredRows].map(r => {
    _runBal += r.type === 'receipt' ? Number(r.amount) : -Number(r.amount);
    return { ...r, balance: _runBal };
  }).reverse();

  /* Client-side sort */
  if (sortBy !== 'date' || sortOrder === 'ASC') {
    displayRows = [...displayRows].sort((a, b) => {
      let va: number, vb: number;
      switch (sortBy) {
        case 'date':    va = new Date(a.date || a.createdAt).getTime(); vb = new Date(b.date || b.createdAt).getTime(); break;
        case 'receipt': va = a.type === 'receipt' ? Number(a.amount) : 0; vb = b.type === 'receipt' ? Number(b.amount) : 0; break;
        case 'payment': va = a.type === 'payment' ? Number(a.amount) : 0; vb = b.type === 'payment' ? Number(b.amount) : 0; break;
        case 'balance': va = a.balance; vb = b.balance; break;
        default: return 0;
      }
      return sortOrder === 'ASC' ? va - vb : vb - va;
    });
  }

  const totalPages = Math.max(1, Math.ceil(displayRows.length / pageSize));
  const pageRows = displayRows.slice((page - 1) * pageSize, page * pageSize);

  function handleSort(field: string) {
    if (sortBy === field) setSortOrder(o => o === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(field); setSortOrder('DESC'); }
    setPage(1);
  }

  /* Sticky offsets */
  const dateW = colWidths['date'] ?? DEF_W['date'];
  const pinnedInOrder = orderedVisible.slice(0, pinnedCount);
  const pinnedSet = new Set(pinnedInOrder);
  let dynPinnedLeft = dateW;
  const pinnedLeftMap: Record<string, number> = {};
  for (const k of pinnedInOrder) {
    pinnedLeftMap[k] = dynPinnedLeft;
    dynPinnedLeft += colWidths[k] ?? DEF_W[k] ?? 120;
  }
  const balanceW = colWidths['balance'] ?? DEF_W['balance'];

  const thBase = 'px-3 py-3 text-xs font-bold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-gray-50 border-b border-gray-100 select-none';
  const tdCls = 'px-3 py-0 text-sm text-gray-600 border-b border-gray-50';

  function SortArrow({ field }: { field: string }) {
    if (sortBy !== field) return null;
    return <span className="ml-1 text-blue-500">{sortOrder === 'ASC' ? '↑' : '↓'}</span>;
  }
  function thStyle(key: string): React.CSSProperties { const w = colWidths[key] ?? DEF_W[key] ?? 120; return { width: w, minWidth: w }; }
  function thStickyStyle(left: number, key: string, pinned = false): React.CSSProperties {
    return { ...thStyle(key), position: 'sticky', left, zIndex: 3, background: pinned ? '#eff6ff' : '#f9fafb' };
  }
  function tdStyle(key: string, isPin: boolean, left: number, bg: string): React.CSSProperties {
    const w = colWidths[key] ?? DEF_W[key] ?? 120;
    return isPin ? { width: w, minWidth: w, position: 'sticky', left, zIndex: 1, background: bg } : { width: w, minWidth: w };
  }

  const totalColCount = orderedVisible.length + 2;

  function exportXlsx() {
    import('xlsx').then(XLSX => {
      const data = filteredRows.map((r, i) => ({
        'STT': i + 1,
        'Ngày ghi nhận': fmtDate(r.date || r.createdAt),
        'Mã phiếu': r.code,
        'Loại': r.type === 'receipt' ? 'Phiếu thu' : 'Phiếu chi',
        'Diễn giải': r.category || r.note || '',
        'PTTT': PM_LABEL[r.paymentMethod] || r.paymentMethod,
        'Đối tác': r.partner?.name || r.doiTuongTen || '',
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
            <span className="text-gray-600">{dateMode === 'custom' ? `${dateFrom} → ${dateTo}` : (PRESET_LABEL[dateMode] || `${dateFrom} → ${dateTo}`)}</span>
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showDatePicker && (
            <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 w-72">
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[['today','Hôm nay'],['yesterday','Hôm qua'],['7days','7 ngày qua'],['30days','30 ngày qua'],['lastMonth','Tháng trước'],['thisMonth','Tháng này'],['lastYear','Năm trước'],['thisYear','Năm nay']].map(([key, label]) => (
                  <button key={key} onClick={() => applyPreset(key)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition ${dateMode === key ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="border-t border-gray-100 pt-3">
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

        <select value={quy} onChange={e => setQuy(e.target.value)} title="Quỹ công ty không tính tiền ở tài khoản cá nhân (VD tài khoản chủ dùng trả NCC nước ngoài)"
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="cong_ty">Quỹ công ty</option>
          <option value="ca_nhan">Tiền cá nhân</option>
          <option value="">Tất cả (công ty + cá nhân)</option>
        </select>
        <select value={pttt} onChange={e => setPttt(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400">
          {PTTT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={branchId} onChange={e => setBranchId(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">Tất cả chi nhánh</option>
          {branches.map(b => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
        </select>
        <select value={createdById} onChange={e => setCreatedById(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">Tất cả người tạo</option>
          {employees.map(e => <option key={e.id} value={String(e.id)}>{e.fullName}</option>)}
        </select>
      </div>

      {/* Summary bar */}
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
            <span className={`px-2 py-0.5 text-xs font-medium rounded-lg ${PM_COLOR[pm] || 'bg-gray-100 text-gray-500'}`}>{PM_LABEL[pm] || pm}</span>
            <span className={`text-sm font-bold ${bal >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtMoney(bal)}</span>
          </div>
        ))}
      </div>

      {/* Tabs + Search + Gear + Export */}
      <div className="px-6 pb-2 flex items-center gap-3">
        {/* Gear */}
        <button onClick={() => setShowColModal(true)}
          className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition shrink-0"
          title="Tùy chỉnh cột hiển thị">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <div className="w-px h-5 bg-gray-200 shrink-0" />
        <div className="flex gap-1 border-b border-gray-200 shrink-0">
          {([['', 'Tất cả'], ['receipt', 'Phiếu thu'], ['payment', 'Phiếu chi']] as [string, string][]).map(([val, label]) => (
            <button key={val} onClick={() => { setTypeFilter(val as '' | 'receipt' | 'payment'); setPage(1); }}
              className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${typeFilter === val ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" /></svg>
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Tìm mã phiếu, diễn giải, đối tác..."
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        <button onClick={exportXlsx}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Xuất file
        </button>
      </div>

      {/* Table area */}
      <div className="flex-1 min-h-0 px-6 pb-4 overflow-hidden flex flex-col gap-3">
        {truncated && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 shrink-0">
            <span>⚠️</span>
            <span>Dữ liệu vượt giới hạn hiển thị — số dư lũy kế có thể không chính xác. Hãy lọc theo khoảng thời gian hẹp hơn.</span>
          </div>
        )}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="w-full min-w-max text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead className="sticky top-0 z-10">
                <tr>
                  {/* Ngày ghi nhận — fixed first, always sticky */}
                  <th className={`${thBase} cursor-pointer group/th text-right`}
                    style={thStickyStyle(0, 'date')}
                    onClick={() => handleSort('date')}>
                    <div className="flex items-center justify-between relative">
                      <span className="ml-auto">Ngày GN<SortArrow field="date" /></span>
                      <div onMouseDown={e => onResizeMouseDown(e, 'date')}
                        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 opacity-0 group-hover/th:opacity-100 transition-opacity" />
                    </div>
                  </th>
                  {/* Dynamic pinned + unpinned columns */}
                  {orderedVisible.map((key, dynIdx) => {
                    const isPin = pinnedSet.has(key);
                    const isLastPin = isPin && dynIdx === pinnedCount - 1;
                    const isSortable = key === 'receipt' || key === 'payment';
                    const sortField = key;
                    const isRight = RIGHT_COLS.has(key);
                    const align = isRight ? 'text-right' : 'text-left';
                    return (
                      <th key={key}
                        className={`${thBase} group/th ${isSortable ? 'cursor-pointer' : ''} ${align} ${isLastPin ? 'border-r-2 border-blue-300' : ''}`}
                        style={isPin ? thStickyStyle(pinnedLeftMap[key] ?? 0, key, true) : thStyle(key)}
                        onClick={isSortable ? () => handleSort(sortField) : undefined}>
                        <div className="flex items-center justify-between relative">
                          <span className={[isRight ? 'ml-auto' : '',
                            key === 'receipt' ? 'text-emerald-600' : key === 'payment' ? 'text-red-500' : ''].join(' ')}>
                            {colShortLabelMap[key]}{isSortable && <SortArrow field={sortField} />}
                          </span>
                          <div onMouseDown={e => onResizeMouseDown(e, key)}
                            className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 opacity-0 group-hover/th:opacity-100 transition-opacity" />
                        </div>
                      </th>
                    );
                  })}
                  {/* Số dư lũy kế — fixed last */}
                  <th className={`${thBase} text-right cursor-pointer group/th`}
                    style={{ ...thStyle('balance'), position: 'sticky', right: 0, zIndex: 3, background: '#eff6ff' }}
                    onClick={() => handleSort('balance')}>
                    <div className="flex items-center justify-end relative">
                      <span className="text-blue-600">Số dư LK<SortArrow field="balance" /></span>
                      <div onMouseDown={e => onResizeMouseDown(e, 'balance')}
                        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 opacity-0 group-hover/th:opacity-100 transition-opacity" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: pageSize > 15 ? 8 : pageSize }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: totalColCount }).map((_, j) => (
                        <td key={j} className="px-3 py-3 border-b border-gray-50"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : pageRows.length === 0 ? (
                  <tr><td colSpan={totalColCount} className="py-16 text-center text-gray-400 text-sm">Chưa có giao dịch nào trong kỳ</td></tr>
                ) : (
                  pageRows.map(row => {
                    const isHovered = hoveredId === row.id;
                    const rowBg = isHovered ? '#f9fafb' : 'white';
                    const h = rowHeights[row.id] ?? DEFAULT_ROW_H;
                    return (
                      <tr key={row.id} style={{ height: h }}
                        className="transition-colors"
                        onMouseEnter={() => setHoveredId(row.id)}
                        onMouseLeave={e => { setHoveredId(null); e.currentTarget.style.cursor = ''; }}
                        onMouseMove={e => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.cursor = rect.bottom - e.clientY < 7 ? 'row-resize' : 'default'; }}
                        onMouseDown={e => { const rect = e.currentTarget.getBoundingClientRect(); if (rect.bottom - e.clientY < 7) onRowResizeMouseDown(e, row.id); }}>
                        {/* Ngày ghi nhận */}
                        <td className={`${tdCls} text-right`}
                          style={{ ...tdStyle('date', true, 0, rowBg), paddingTop: 0, paddingBottom: 0 }}>
                          <div className="flex items-center justify-end h-full px-1" style={{ height: h }}>
                            <span className="whitespace-nowrap text-gray-500">{fmtDate(row.date || row.createdAt)}</span>
                          </div>
                        </td>
                        {/* Dynamic columns */}
                        {orderedVisible.map((key, dynIdx) => {
                          const isPin = pinnedSet.has(key);
                          const isLastPin = isPin && dynIdx === pinnedCount - 1;
                          const left = pinnedLeftMap[key] ?? 0;
                          const isRight = RIGHT_COLS.has(key);
                          const isWrap = WRAP_TEXT_COLS.has(key);
                          const wrapCls = isWrap ? wrapMode === 'truncate' ? 'truncate' : wrapMode === 'wrap2' ? 'line-clamp-2' : '' : '';
                          const pinBg = isPin ? (isHovered ? '#dbeafe' : '#eff6ff') : rowBg;
                          return (
                            <td key={key}
                              className={`${tdCls} ${isRight ? 'text-right' : 'text-left'} ${isLastPin ? 'border-r-2 border-blue-200' : ''}`}
                              style={{ ...tdStyle(key, isPin, left, pinBg), paddingTop: 0, paddingBottom: 0 }}>
                              <div className={`flex items-center h-full px-1 ${isRight ? 'justify-end' : ''}`} style={{ height: h }}>
                                <div className={`${wrapCls} w-full ${isRight ? 'text-right' : ''}`}>{soQuyCellContent(key, row)}</div>
                              </div>
                            </td>
                          );
                        })}
                        {/* Số dư lũy kế */}
                        <td className={`${tdCls} text-right font-bold`}
                          style={{ ...tdStyle('balance', true, 0, isHovered ? '#dbeafe' : '#eff6ff'), position: 'sticky', right: 0, zIndex: 1, paddingTop: 0, paddingBottom: 0 }}>
                          <div className="flex items-center justify-end h-full px-1" style={{ height: h }}>
                            <span className={`whitespace-nowrap ${row.balance >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>{fmtMoney(row.balance)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {isFiltered && (
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 italic shrink-0">
              * Số dư lũy kế tính riêng theo loại phiếu, không tính số dư đầu kỳ.
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm shrink-0">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                {([10, 15, 30, 50, 100] as const).map(n => (
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
              {filteredRows.length === 0 ? '0' : `${(page-1)*pageSize+1}–${Math.min(page*pageSize, filteredRows.length)}`}
              {' '}trên tổng <span className="font-semibold text-gray-600">{filteredRows.length}</span> giao dịch
            </span>
            <span className="text-gray-200">·</span>
            <span className="text-emerald-600 font-semibold">Thu: {fmtMoney(filteredReceipt)}</span>
            <span className="text-gray-200">·</span>
            <span className="text-red-500 font-semibold">Chi: {fmtMoney(filteredPayment)}</span>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={page === 1} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs font-medium">«</button>
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs">‹</button>
              {Array.from({ length: totalPages }, (_, i) => i+1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p-page) <= 1)
                .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx-1] as number) > 1) acc.push('ellipsis');
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
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs">›</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs font-medium">»</button>
            </div>
          )}
        </div>
      </div>

      {showColModal && (
        <SoQuyColModal
          visibleCols={visibleCols} colOrder={colOrder} pinnedCount={pinnedCount} wrapMode={wrapMode}
          onSave={handleSaveColConfig} onClose={() => setShowColModal(false)}
        />
      )}
    </div>
  );
}
