'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import ChonLoaiPhieu from '@/components/ChonLoaiPhieu';
import { BAN_HANG_URL, laPhieuBanHang } from '@/lib/ban-hang';
import { transactionsApi, branchesApi, PM_LABEL, transactionGroupsApi } from '@/lib/transactions';
import { fmtMoney, fmtDate, getPresetDates, localDateStr } from '@/lib/utils';

interface Tx {
  id: number; code: string; type: 'receipt' | 'payment';
  amount: number; paymentMethod: string; category: string | null;
  note: string | null; date: string | null; createdAt: string;
  isDeleted: boolean;
  branchId?: number | null; tags?: string | null; imageUrl?: string | null;
  affectsBusinessResult?: boolean; payerType?: string | null; reference?: string | null;
  updatedAt?: string | null; deletedAt?: string | null;
  partner?: { id: number; name: string; code?: string } | null;
  /** 'tms' | 'ban_hang' (bản sao từ App Bán hàng — chỉ xem) */
  nguon?: string; doiTuongTen?: string | null; linkGoc?: string | null;
  branchEntity?: { id: number; name: string } | null;
  createdBy?: { id: number; fullName: string; username: string } | null;
  order?: { id: number; code: string } | null;
  groupId?: number | null;
  group?: { id: number; name: string; affectsBusinessResult: boolean } | null;
}
interface PageRes { data: Tx[]; total: number; totalPages: number; summary: { totalPayment: number; count: number }; }

const PTTT_OPTIONS = [
  { value: '', label: 'Tất cả PTTT' },
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'bank_transfer', label: 'Chuyển khoản' },
  { value: 'momo', label: 'MoMo' },
  { value: 'other', label: 'Khác' },
];
const DATE_PRESETS = [
  { value: '', label: 'Tất cả ngày' }, { value: 'today', label: 'Hôm nay' },
  { value: 'yesterday', label: 'Hôm qua' }, { value: 'this_week', label: 'Tuần này' },
  { value: 'last_week', label: 'Tuần trước' }, { value: 'this_month', label: 'Tháng này' },
  { value: 'last_month', label: 'Tháng trước' }, { value: 'custom', label: 'Tùy chọn...' },
];

const ALL_COLS = [
  { key: 'Danh mục',       label: 'Danh mục',               shortLabel: 'Danh mục',    defaultOn: true  },
  { key: 'Diễn giải',      label: 'Diễn giải / Ghi chú',    shortLabel: 'Diễn giải',   defaultOn: true  },
  { key: 'Đối tác',        label: 'Đối tác',                 shortLabel: 'Đối tác',     defaultOn: true  },
  { key: 'PTTT',           label: 'Phương thức TT',          shortLabel: 'PTTT',        defaultOn: true  },
  { key: 'Trạng thái',     label: 'Trạng thái',              shortLabel: 'Trạng thái',  defaultOn: true  },
  { key: 'Chi nhánh',      label: 'Chi nhánh',               shortLabel: 'Chi nhánh',   defaultOn: false },
  { key: 'Tags',           label: 'Tags / Nhãn',             shortLabel: 'Tags',        defaultOn: false },
  { key: 'Người lập',      label: 'Người lập phiếu',         shortLabel: 'Người lập',   defaultOn: false },
  { key: 'Đơn hàng',       label: 'Đơn hàng liên quan',      shortLabel: 'Đơn hàng',    defaultOn: false },
  { key: 'Chứng từ',       label: 'Ảnh chứng từ',            shortLabel: 'Chứng từ',    defaultOn: false },
  { key: 'Ngày tạo',       label: 'Ngày tạo bản ghi',        shortLabel: 'Ngày tạo',    defaultOn: false },
  { key: 'Ngày cập nhật',  label: 'Ngày cập nhật',           shortLabel: 'Cập nhật',    defaultOn: false },
  { key: 'Ngày hủy',       label: 'Ngày hủy phiếu',          shortLabel: 'Ngày hủy',    defaultOn: false },
  { key: 'Nhóm đối tượng', label: 'Nhóm người nhận',         shortLabel: 'Nhóm NNhận',  defaultOn: false },
  { key: 'Mã đối tác',     label: 'Mã đối tác',              shortLabel: 'Mã ĐT',       defaultOn: false },
  { key: 'Tham chiếu',     label: 'Số tham chiếu',           shortLabel: 'Tham chiếu',  defaultOn: false },
  { key: 'KQKD',           label: 'Ảnh hưởng KQKD',          shortLabel: 'KQKD',        defaultOn: false },
  { key: 'Số tiền',        label: 'Số tiền',                  shortLabel: 'Số tiền',     defaultOn: true  },
] as const;

type ColKey = typeof ALL_COLS[number]['key'];
const ALL_COL_KEYS = ALL_COLS.map(c => c.key) as ColKey[];
const defaultColVisibility = Object.fromEntries(ALL_COLS.map(c => [c.key, c.defaultOn])) as Record<ColKey, boolean>;
const colLabelMap = Object.fromEntries(ALL_COLS.map(c => [c.key, c.label])) as Record<ColKey, string>;
const colShortLabelMap = Object.fromEntries(ALL_COLS.map(c => [c.key, c.shortLabel])) as Record<ColKey, string>;
const CENTER_COLS = new Set<ColKey>(['Chứng từ', 'KQKD', 'Trạng thái']);
const RIGHT_COLS = new Set<ColKey>(['Số tiền', 'Ngày tạo', 'Ngày cập nhật', 'Ngày hủy']);
const WRAP_TEXT_COLS = new Set<ColKey>(['Danh mục', 'Diễn giải', 'Đối tác', 'PTTT', 'Chi nhánh', 'Người lập', 'Nhóm đối tượng', 'Tham chiếu', 'Mã đối tác']);
const SORTABLE_DYN: Partial<Record<ColKey, string>> = { 'Ngày tạo': 'createdAt', 'Số tiền': 'amount' };

const COL_WIDTHS_KEY = 'phieu_chi_col_widths_v1';
const ROW_HEIGHTS_KEY = 'phieu_chi_row_heights_v1';
const PINNED_KEY = 'phieu_chi_pinned_v1';
const WRAP_KEY = 'phieu_chi_wrap_v1';
const DEFAULT_ROW_HEIGHT = 44;

const DEF_W: Record<string, number> = {
  date: 120, code: 130,
  'Danh mục': 150, 'Diễn giải': 190, 'Đối tác': 150, 'PTTT': 110, 'Trạng thái': 100,
  'Chi nhánh': 120, 'Tags': 140, 'Người lập': 130, 'Đơn hàng': 120, 'Chứng từ': 80,
  'Ngày tạo': 120, 'Ngày cập nhật': 120, 'Ngày hủy': 120, 'Nhóm đối tượng': 130,
  'Mã đối tác': 110, 'Tham chiếu': 120, 'KQKD': 90, 'Số tiền': 140,
};

type WrapMode = 'truncate' | 'wrap2' | 'wrap';

/* ── Inline column config modal ── */
function ChiColModal({ visibleCols, colOrder, pinnedCount, wrapMode, onSave, onClose }: {
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
  const filteredInactive = search
    ? inactiveKeys.filter(k => colLabelMap[k].toLowerCase().includes(search.toLowerCase()))
    : inactiveKeys;

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
  function handleReset() {
    setActiveItems(ALL_COLS.filter(c => c.defaultOn).map(c => c.key) as ColKey[]);
    setLocalPinCount(0); setLocalWrap('truncate'); setSearch('');
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '85vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-gray-800 text-base">Điều chỉnh cột hiển thị</h2>
            <p className="text-xs text-gray-400 mt-0.5">Chọn cột, kéo thả để sắp xếp, ghim cột và chọn chế độ hiển thị</p>
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
                  className={`px-3 py-1 text-xs font-medium transition border-r border-gray-200 last:border-r-0 ${localPinCount === n ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
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
                className={`px-3 py-1 text-xs rounded-lg border transition ${localWrap === v ? 'bg-red-50 border-red-300 text-red-600 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
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
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {filteredInactive.length === 0
                ? <p className="text-center text-gray-400 text-xs py-8">{search ? 'Không tìm thấy' : 'Tất cả cột đã hiển thị'}</p>
                : filteredInactive.map(key => (
                  <button key={key} onClick={() => setActiveItems(p => [...p, key])}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition text-left">
                    <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
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
                        dragOverIdx === idx && draggingIdx !== idx ? 'bg-blue-50 border-t-2 border-blue-400' : isPinned ? 'bg-red-50/50' : 'hover:bg-gray-50',
                      ].join(' ')}>
                      <svg className="w-4 h-4 text-gray-300 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="5.5" cy="4" r="1.2"/><circle cx="10.5" cy="4" r="1.2"/>
                        <circle cx="5.5" cy="8" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/>
                        <circle cx="5.5" cy="12" r="1.2"/><circle cx="10.5" cy="12" r="1.2"/>
                      </svg>
                      {isPinned && (
                        <svg className="w-3 h-3 text-red-400 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                      )}
                      <span className={`flex-1 text-sm ${isPinned ? 'text-red-700 font-medium' : 'text-gray-700'}`}>{colLabelMap[key]}</span>
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
            <button onClick={handleSave} className="px-5 py-2 text-sm font-semibold text-white rounded-xl transition bg-red-600 hover:bg-red-700">Lưu</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Cell content renderer (no <td>) ── */
function chiCellContent(key: ColKey, tx: Tx): React.ReactNode {
  switch (key) {
    case 'Danh mục':
      return (
        <div className="flex items-center gap-1.5">
          {tx.order && <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100 rounded-md">Tự động</span>}
          <span className="text-gray-600" title={tx.group?.name || tx.category || undefined}>{tx.group?.name || tx.category || '—'}</span>
        </div>
      );
    case 'Diễn giải':
      return <span className="text-gray-500" title={tx.note || undefined}>{tx.note || '—'}</span>;
    case 'Đối tác':
      return tx.partner
        ? <a href={`/dashboard/partners/${tx.partner.id}`} className="text-red-600 hover:underline font-medium">{tx.partner.name}</a>
        : tx.doiTuongTen ? <span className="text-gray-700">{tx.doiTuongTen}</span> : <span className="text-gray-400">—</span>;
    case 'PTTT':
      return <span className="text-gray-500">{PM_LABEL[tx.paymentMethod] || tx.paymentMethod}</span>;
    case 'Chi nhánh':
      return <span className="text-gray-500">{tx.branchEntity?.name || '—'}</span>;
    case 'Tags':
      return tx.tags ? (
        <div className="flex flex-wrap gap-1">
          {tx.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
            <span key={t} className="px-1.5 py-0.5 text-[11px] bg-red-50 text-red-700 border border-red-100 rounded-md">{t}</span>
          ))}
        </div>
      ) : <span className="text-gray-400">—</span>;
    case 'Người lập':
      return <span className="text-gray-600 whitespace-nowrap">{tx.createdBy?.fullName || '—'}</span>;
    case 'Đơn hàng':
      return tx.order
        ? <span className="font-mono text-sm bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded">{tx.order.code}</span>
        : <span className="text-gray-400">—</span>;
    case 'Chứng từ':
      return tx.imageUrl
        ? <span title="Có ảnh chứng từ" className="inline-flex items-center justify-center w-6 h-6 bg-red-100 text-red-600 rounded-full">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </span>
        : <span className="text-gray-300">—</span>;
    case 'Ngày tạo':
      return <span className="text-gray-400 whitespace-nowrap">{fmtDate(tx.createdAt)}</span>;
    case 'Ngày cập nhật':
      return <span className="text-gray-400 whitespace-nowrap">{tx.updatedAt ? fmtDate(tx.updatedAt) : '—'}</span>;
    case 'Ngày hủy':
      return <span className="text-gray-400 whitespace-nowrap">{tx.deletedAt ? fmtDate(tx.deletedAt) : '—'}</span>;
    case 'Nhóm đối tượng':
      return <span className="text-gray-500">{tx.payerType ? ({ customer: 'Khách hàng', supplier: 'Nhà cung cấp', employee: 'Nhân viên', other: 'Khác' } as Record<string, string>)[tx.payerType] || tx.payerType : '—'}</span>;
    case 'Mã đối tác':
      return tx.partner
        ? <a href={`/dashboard/partners/${tx.partner.id}`} className="font-mono text-gray-600 hover:text-red-600 hover:underline">{tx.partner.code || tx.partner.id}</a>
        : <span className="text-gray-400">—</span>;
    case 'Tham chiếu':
      return <span className="text-gray-500">{tx.reference || '—'}</span>;
    case 'KQKD':
      return tx.affectsBusinessResult !== false
        ? <span className="px-1.5 py-0.5 text-[11px] bg-emerald-50 text-emerald-700 rounded">Có</span>
        : <span className="px-1.5 py-0.5 text-[11px] bg-gray-100 text-gray-500 rounded">Không</span>;
    case 'Trạng thái':
      return tx.isDeleted
        ? <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded-lg">Đã hủy</span>
        : <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-lg">Hoàn thành</span>;
    case 'Số tiền':
      return <span className="text-red-500 whitespace-nowrap">{fmtMoney(Number(tx.amount))}</span>;
    default: return null;
  }
}

/* ── Main Page ── */
export default function PhieuChiPage() {
  const [rows, setRows] = useState<Tx[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ totalPayment: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<10 | 15 | 30 | 50 | 100>(30);
  const [statusTab, setStatusTab] = useState<'all' | 'active' | 'deleted'>('all');
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState('this_month');
  const [dateFrom, setDateFrom] = useState(() => getPresetDates('this_month').from);
  const [dateTo, setDateTo] = useState(() => getPresetDates('this_month').to);
  const [pttt, setPttt] = useState('');
  const [groupId, setGroupId] = useState('');
  const [groups, setGroups] = useState<{ id: number; name: string; code: string; affectsBusinessResult: boolean }[]>([]);
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [showColModal, setShowColModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const showCheckboxes = selectionMode || selectedIds.size > 0;
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const rowResizingRef = useRef(false);

  const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>(() => {
    try { const s = localStorage.getItem('phieu_chi_cols'); if (s) return { ...defaultColVisibility, ...JSON.parse(s) }; } catch {}
    return defaultColVisibility;
  });
  const [colOrder, setColOrder] = useState<ColKey[]>(() => {
    try {
      const s = localStorage.getItem('phieu_chi_col_order');
      if (s) { const p = JSON.parse(s) as ColKey[]; return [...p, ...ALL_COL_KEYS.filter(k => !p.includes(k))]; }
    } catch {}
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
    try { const s = localStorage.getItem(WRAP_KEY); if (s && ['truncate', 'wrap2', 'wrap'].includes(s)) return s as WrapMode; } catch {}
    return 'truncate';
  });

  const orderedVisible = colOrder.filter(k => visibleCols[k]);

  function handleSaveColConfig(newVisible: Record<ColKey, boolean>, newOrder: ColKey[], newPinnedCount: number, newWrap: WrapMode) {
    setVisibleCols(newVisible); setColOrder(newOrder); setPinnedCount(newPinnedCount); setWrapMode(newWrap);
    try {
      localStorage.setItem('phieu_chi_cols', JSON.stringify(newVisible));
      localStorage.setItem('phieu_chi_col_order', JSON.stringify(newOrder));
      localStorage.setItem(PINNED_KEY, String(newPinnedCount));
      localStorage.setItem(WRAP_KEY, newWrap);
    } catch {}
  }

  function onResizeMouseDown(e: React.MouseEvent, colKey: string) {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[colKey] ?? DEF_W[colKey] ?? 120;
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
    function onMove(ev: MouseEvent) {
      const w = Math.max(60, startW + ev.clientX - startX);
      setColWidths(p => { const n = { ...p, [colKey]: w }; try { localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(n)); } catch {} return n; });
    }
    function onUp() { document.body.style.cursor = ''; document.body.style.userSelect = ''; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  }

  function onRowResizeMouseDown(e: React.MouseEvent, txId: number) {
    e.preventDefault(); e.stopPropagation();
    rowResizingRef.current = true;
    const startY = e.clientY; const startH = rowHeights[txId] ?? DEFAULT_ROW_HEIGHT;
    document.body.style.cursor = 'row-resize'; document.body.style.userSelect = 'none';
    function onMove(ev: MouseEvent) {
      const h = Math.max(28, startH + ev.clientY - startY);
      setRowHeights(p => { const n = { ...p, [txId]: h }; try { localStorage.setItem(ROW_HEIGHTS_KEY, JSON.stringify(n)); } catch {} return n; });
    }
    function onUp() { document.body.style.cursor = ''; document.body.style.userSelect = ''; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); setTimeout(() => { rowResizingRef.current = false; }, 50); }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  }

  function handleSort(field: string) {
    if (sortBy === field) setSortOrder(o => o === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(field); setSortOrder('DESC'); }
    setPage(1);
  }

  useEffect(() => { branchesApi.getAll().then(r => setBranches(r.data || r || [])).catch(() => {}); }, []);
  useEffect(() => { transactionGroupsApi.getAll('payment').then((r: any) => setGroups(r || [])).catch(() => {}); }, []);

  const buildParams = useCallback((extra?: Record<string, string>) => {
    const params: Record<string, string> = { type: 'payment', ...extra };
    if (statusTab === 'deleted') params.isDeleted = 'true';
    if (search) params.search = search;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    if (pttt) params.paymentMethod = pttt;
    if (groupId) params.groupId = groupId;
    if (branchId) params.branchId = branchId;
    params.sortBy = sortBy; params.sortOrder = sortOrder;
    return params;
  }, [statusTab, search, dateFrom, dateTo, pttt, groupId, branchId, sortBy, sortOrder]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res: PageRes = await transactionsApi.getAll(buildParams({ page: String(page), limit: String(limit) }));
      setRows(res.data); setTotal(res.total); setTotalPages(res.totalPages); setSummary(res.summary); setSelectedIds(new Set());
    } catch {}
    finally { setLoading(false); }
  }, [page, limit, buildParams]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const tai = () => { if (document.visibilityState === 'visible') loadData(); };
    window.addEventListener('focus', tai);
    return () => window.removeEventListener('focus', tai);
  }, [loadData]);
  const [chonLoai, setChonLoai] = useState(false);

  function applyPreset(preset: string) {
    setDatePreset(preset);
    if (preset !== 'custom' && preset !== '') { const { from, to } = getPresetDates(preset); setDateFrom(from); setDateTo(to); }
    else if (preset === '') { setDateFrom(''); setDateTo(''); }
    setPage(1);
  }

  function toggleSelectAll() { setSelectionMode(true); if (selectedIds.size === rows.length) setSelectedIds(new Set()); else setSelectedIds(new Set(rows.map(r => r.id))); }
  function toggleSelect(id: number) { setSelectionMode(true); setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; }); }
  function exitSelectionMode() { setSelectionMode(false); setSelectedIds(new Set()); }

  async function handleBulkDelete() { setShowConfirmCancel(true); }
  async function confirmBulkDelete() {
    setShowConfirmCancel(false);
    const dsId = rows.filter(t => selectedIds.has(t.id) && !laPhieuBanHang(t)).map(t => t.id);
    const boQua = selectedIds.size - dsId.length;
    if (boQua) alert(`Bỏ qua ${boQua} phiếu từ App Bán hàng — huỷ / khôi phục bên App Bán hàng.`);
    await Promise.all(dsId.map(id => transactionsApi.remove(id)));
    loadData();
  }
  async function handleBulkRestore() {
    const dsId = rows.filter(t => selectedIds.has(t.id) && !laPhieuBanHang(t)).map(t => t.id);
    const boQua = selectedIds.size - dsId.length;
    if (boQua) alert(`Bỏ qua ${boQua} phiếu từ App Bán hàng — huỷ / khôi phục bên App Bán hàng.`);
    await Promise.all(dsId.map(id => transactionsApi.restore(id))); loadData();
  }

  function handleBulkPrint() {
    const selected = rows.filter(r => selectedIds.has(r.id));
    const totalAmt = selected.reduce((s, tx) => s + Number(tx.amount), 0);
    const rowsHtml = selected.map(tx => `
      <tr>
        <td>${fmtDate(tx.date || tx.createdAt)}</td>
        <td style="font-family:monospace;font-weight:600">${tx.code}</td>
        <td>${tx.group?.name || tx.category || '—'}</td>
        <td>${tx.note || '—'}</td>
        <td>${tx.partner?.name || tx.doiTuongTen || '—'}</td>
        <td>${PM_LABEL[tx.paymentMethod] || tx.paymentMethod}</td>
        <td style="text-align:right;color:#dc2626;font-weight:600">${fmtMoney(Number(tx.amount))}</td>
        <td>${tx.isDeleted ? 'Đã hủy' : 'Hoàn thành'}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>In phiếu chi</title>
      <style>body{font-family:Arial,sans-serif;font-size:13px;color:#111;margin:24px}h2{color:#dc2626;margin:0 0 4px}p{color:#666;margin:0 0 16px;font-size:12px}table{width:100%;border-collapse:collapse}th{background:#fef2f2;color:#374151;text-align:left;padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #fecaca}td{padding:8px 10px;border-bottom:1px solid #f3f4f6}.total{text-align:right;padding:12px 10px 0;font-weight:bold;color:#dc2626;font-size:15px}@media print{body{margin:0}}</style>
      </head><body>
      <h2>Danh sách phiếu chi</h2>
      <p>In ngày: ${new Date().toLocaleDateString('vi-VN')} — Tổng: ${selected.length} phiếu</p>
      <table><thead><tr><th>Ngày chi</th><th>Mã phiếu</th><th>Danh mục</th><th>Diễn giải</th><th>Đối tác</th><th>PTTT</th><th>Số tiền</th><th>Trạng thái</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="total">Tổng chi: ${fmtMoney(totalAmt)}</div>
      <script>window.onload=function(){window.print()}<\/script></body></html>`;
    const win = window.open('', '_blank', 'width=960,height=700');
    if (win) { win.document.write(html); win.document.close(); }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res: PageRes = await transactionsApi.getAll(buildParams({ limit: '1000', sortBy: 'date', sortOrder: 'DESC' }));
      const data = res.data as Tx[];
      const BOM = '﻿';
      const headers = ['Ngày', 'Mã phiếu', 'Danh mục', 'Diễn giải', 'Đối tác', 'PTTT', 'Chi nhánh', 'Số tiền (VNĐ)', 'Trạng thái'];
      const csvRows = [headers.join(','), ...data.map(tx => [
        fmtDate(tx.date || tx.createdAt), tx.code,
        `"${((tx.group?.name || tx.category) || '').replace(/"/g, '""')}"`,
        `"${(tx.note || '').replace(/"/g, '""')}"`,
        `"${(tx.partner?.name || tx.doiTuongTen || '').replace(/"/g, '""')}"`,
        PM_LABEL[tx.paymentMethod] || tx.paymentMethod,
        `"${(tx.branchEntity?.name || '').replace(/"/g, '""')}"`,
        tx.amount, tx.isDeleted ? 'Đã hủy' : 'Hoàn thành',
      ].join(','))].join('\n');
      const blob = new Blob([BOM + csvRows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `phieu-chi-${localDateStr()}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
    finally { setExporting(false); }
  }

  const hasFilter = !!(search || pttt || groupId || branchId || dateFrom || dateTo);
  const totalColCount = orderedVisible.length + (showCheckboxes ? 3 : 2);

  /* Compute sticky left offsets */
  const cbW = showCheckboxes ? 40 : 0;
  const dateW = colWidths['date'] ?? DEF_W['date'];
  const codeW = colWidths['code'] ?? DEF_W['code'];
  const pinnedInOrder = orderedVisible.slice(0, pinnedCount);
  const pinnedSet = new Set(pinnedInOrder);
  let dynPinnedLeft = cbW + dateW + codeW;
  const pinnedLeftMap: Record<string, number> = {};
  for (const k of pinnedInOrder) {
    pinnedLeftMap[k] = dynPinnedLeft;
    dynPinnedLeft += colWidths[k] ?? DEF_W[k] ?? 120;
  }

  const thBase = 'px-3 py-3 text-xs font-bold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-gray-50 border-b border-gray-100 select-none';
  const tdCls = 'px-3 py-0 text-sm text-gray-600 border-b border-gray-50';

  function SortArrow({ field }: { field: string }) {
    if (sortBy !== field) return <span className="ml-1 text-gray-300 group-hover/th:text-gray-400 transition">↕</span>;
    return <span className="ml-1 text-red-500">{sortOrder === 'ASC' ? '↑' : '↓'}</span>;
  }

  function thStyle(key: string): React.CSSProperties {
    const w = colWidths[key] ?? DEF_W[key] ?? 120;
    return { width: w, minWidth: w };
  }

  function thStickyStyle(left: number, key: string, pinned = false): React.CSSProperties {
    return { ...thStyle(key), position: 'sticky', left, zIndex: 3, background: pinned ? '#fef2f2' : '#f9fafb' };
  }

  function tdStyle(key: string, isPin: boolean, left: number, bg: string): React.CSSProperties {
    const w = colWidths[key] ?? DEF_W[key] ?? 120;
    return isPin
      ? { width: w, minWidth: w, position: 'sticky', left, zIndex: 1, background: bg }
      : { width: w, minWidth: w };
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Phiếu Chi</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-xs text-gray-400">Quản lý các khoản chi tiêu</p>
            <span className="text-gray-200">|</span>
            <Link href="/dashboard/thu-chi/loai-phieu-chi" className="text-xs text-red-600 hover:text-red-700 hover:underline font-medium">Loại phiếu chi</Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-60 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            {exporting ? 'Đang xuất...' : 'Xuất file'}
          </button>
          <button onClick={() => setChonLoai(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-xl hover:bg-red-700 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Tạo phiếu chi
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="px-6 pt-4 bg-white border-b border-gray-100">
        <div className="flex gap-1">
          {[{ key: 'all', label: 'Tất cả phiếu chi' }, { key: 'active', label: 'Hoàn thành' }, { key: 'deleted', label: 'Đã hủy' }].map(t => (
            <button key={t.key} onClick={() => { setStatusTab(t.key as any); setPage(1); }}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition ${statusTab === t.key ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-gray-100 flex-wrap">
        {/* Gear + selection toggle */}
        <button onClick={() => setShowColModal(true)}
          className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition shrink-0"
          title="Tùy chỉnh cột hiển thị">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <button onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
          title={selectionMode ? 'Thoát chọn' : 'Chọn nhiều'}
          className={`w-8 h-8 flex items-center justify-center rounded-lg border transition shrink-0 ${selectionMode ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 17.5h7M17.5 14v7"/>
          </svg>
        </button>
        <div className="w-px h-5 bg-gray-200 shrink-0" />
        <div className="relative flex-1 min-w-52">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm theo mã phiếu, diễn giải, đối tác..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400" />
        </div>
        <select value={datePreset} onChange={e => applyPreset(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400">
          {DATE_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {datePreset === 'custom' && (
          <>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400" />
            <span className="text-gray-400 text-sm">→</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400" />
          </>
        )}
        <select value={pttt} onChange={e => { setPttt(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400">
          {PTTT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={groupId} onChange={e => { setGroupId(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400">
          <option value="">Tất cả loại phiếu</option>
          {groups.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
        </select>
        <select value={branchId} onChange={e => { setBranchId(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400">
          <option value="">Tất cả chi nhánh</option>
          {branches.map(b => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
        </select>
        {hasFilter && (
          <button onClick={() => { setSearch(''); setPttt(''); setGroupId(''); setBranchId(''); applyPreset('this_month'); setPage(1); }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl">Xóa lọc</button>
        )}
      </div>

      {/* Table area */}
      <div className="flex-1 min-h-0 px-6 py-4 overflow-hidden">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col overflow-hidden">

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-5 py-2.5 bg-red-50 border-b border-red-100 rounded-t-2xl">
              <span className="text-sm font-semibold text-red-700">Đã chọn <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-md">{selectedIds.size}</span> phiếu chi</span>
              {statusTab !== 'deleted' && (
                <button onClick={handleBulkDelete} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 transition shadow-sm">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Hủy phiếu
                </button>
              )}
              {statusTab === 'deleted' && (
                <button onClick={handleBulkRestore} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-50 transition shadow-sm">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Khôi phục
                </button>
              )}
              <button onClick={handleBulkPrint} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-50 transition shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                In phiếu
              </button>
              <button onClick={exitSelectionMode} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Bỏ chọn</button>
            </div>
          )}


          <div className="flex-1 overflow-auto">
            <table className="w-full min-w-max text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead className="sticky top-0 z-10">
                <tr>
                  {showCheckboxes && (
                    <th className={`${thBase} text-center`} style={{ width: 40, minWidth: 40, position: 'sticky', left: 0, zIndex: 4 }}>
                      <input type="checkbox"
                        checked={rows.length > 0 && selectedIds.size === rows.length}
                        ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < rows.length; }}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 accent-red-600 cursor-pointer" />
                    </th>
                  )}
                  {/* Ngày chi — always sticky */}
                  <th className={`${thBase} group/th cursor-pointer`}
                    style={thStickyStyle(cbW, 'date')}
                    onClick={() => handleSort('date')}>
                    <div className="flex items-center justify-between">
                      <span>Ngày chi<SortArrow field="date" /></span>
                      <div onMouseDown={e => onResizeMouseDown(e, 'date')}
                        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 opacity-0 group-hover/th:opacity-100 transition-opacity" />
                    </div>
                  </th>
                  {/* Mã phiếu — always sticky */}
                  <th className={`${thBase} group/th cursor-pointer`}
                    style={thStickyStyle(cbW + dateW, 'code')}
                    onClick={() => handleSort('code')}>
                    <div className="flex items-center justify-between relative">
                      <span>Mã phiếu<SortArrow field="code" /></span>
                      <div onMouseDown={e => onResizeMouseDown(e, 'code')}
                        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 opacity-0 group-hover/th:opacity-100 transition-opacity" />
                    </div>
                  </th>
                  {/* Dynamic columns */}
                  {orderedVisible.map((key, dynIdx) => {
                    const isPin = pinnedSet.has(key);
                    const isLastPin = isPin && dynIdx === pinnedCount - 1;
                    const isSortable = key in SORTABLE_DYN;
                    const sortField = SORTABLE_DYN[key];
                    const align = CENTER_COLS.has(key) ? 'text-center' : RIGHT_COLS.has(key) ? 'text-right' : 'text-left';
                    return (
                      <th key={key}
                        className={`${thBase} group/th ${isSortable ? 'cursor-pointer' : ''} ${align} ${isLastPin ? 'border-r-2 border-red-300' : ''}`}
                        style={isPin ? thStickyStyle(pinnedLeftMap[key] ?? 0, key, true) : thStyle(key)}
                        onClick={isSortable && sortField ? () => handleSort(sortField) : undefined}>
                        <div className="flex items-center justify-between relative">
                          <span className={align === 'text-right' ? 'ml-auto' : ''}>
                            {colShortLabelMap[key]}
                            {isSortable && sortField && <SortArrow field={sortField} />}
                          </span>
                          <div onMouseDown={e => onResizeMouseDown(e, key)}
                            className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 opacity-0 group-hover/th:opacity-100 transition-opacity" />
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: totalColCount }).map((_, j) => (
                        <td key={j} className="px-3 py-3 border-b border-gray-50"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr><td colSpan={totalColCount} className="py-16 text-center text-gray-400 text-sm">Chưa có phiếu chi nào</td></tr>
                ) : (
                  rows.map(tx => {
                    const isHovered = hoveredId === tx.id;
                    const rowBg = selectedIds.has(tx.id) ? '#fef2f2' : isHovered ? '#f9fafb' : 'white';
                    const h = rowHeights[tx.id] ?? DEFAULT_ROW_HEIGHT;
                    return (
                      <tr key={tx.id}
                        style={{ height: h }}
                        className={`transition-colors ${tx.isDeleted ? 'opacity-50' : ''}`}
                        onMouseEnter={() => setHoveredId(tx.id)}
                        onMouseLeave={e => { setHoveredId(null); e.currentTarget.style.cursor = ''; }}
                        onMouseMove={e => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.cursor = rect.bottom - e.clientY < 7 ? 'row-resize' : 'default'; }}
                        onMouseDown={e => { const rect = e.currentTarget.getBoundingClientRect(); if (rect.bottom - e.clientY < 7) onRowResizeMouseDown(e, tx.id); }}>
                        {showCheckboxes && (
                          <td className="w-10 pl-4 border-b border-gray-50 text-center" style={{ position: 'sticky', left: 0, zIndex: 1, background: rowBg }}>
                            <input type="checkbox" checked={selectedIds.has(tx.id)} onChange={() => toggleSelect(tx.id)}
                              className="w-4 h-4 rounded border-gray-300 accent-red-600 cursor-pointer" />
                          </td>
                        )}
                        {/* Ngày chi — always sticky */}
                        <td className={`${tdCls} whitespace-nowrap text-right`}
                          style={{ ...tdStyle('date', true, cbW, rowBg), paddingTop: 0, paddingBottom: 0 }}>
                          <div className="flex items-center justify-end h-full px-1" style={{ height: h }}>
                            {fmtDate(tx.date || tx.createdAt)}
                          </div>
                        </td>
                        {/* Mã phiếu — always sticky */}
                        <td className={`${tdCls}`}
                          style={{ ...tdStyle('code', true, cbW + dateW, rowBg), paddingTop: 0, paddingBottom: 0 }}>
                          <div className="flex items-center h-full px-1" style={{ height: h }}>
                            <a href={laPhieuBanHang(tx) && tx.linkGoc && BAN_HANG_URL ? `${BAN_HANG_URL}${tx.linkGoc}` : `/dashboard/thu-chi/phieu-chi/${tx.id}`}
                              target={laPhieuBanHang(tx) ? 'anphat-ban-hang' : undefined}
                              title={laPhieuBanHang(tx) ? 'Phiếu từ App Bán hàng (cùng mã) — bấm để mở phiếu gốc; sửa / huỷ bên App Bán hàng' : undefined}
                              onClick={e => { if (rowResizingRef.current) e.preventDefault(); }}
                              className="font-mono text-red-600 font-semibold hover:underline hover:text-red-700 whitespace-nowrap">
                              {tx.code}{laPhieuBanHang(tx) && <span className="ml-1 text-indigo-500 font-sans" aria-label="từ App Bán hàng">↗</span>}
                            </a>
                          </div>
                        </td>
                        {/* Dynamic columns */}
                        {orderedVisible.map((key, dynIdx) => {
                          const isPin = pinnedSet.has(key);
                          const isLastPin = isPin && dynIdx === pinnedCount - 1;
                          const left = pinnedLeftMap[key] ?? 0;
                          const isCenter = CENTER_COLS.has(key);
                          const isRight = RIGHT_COLS.has(key);
                          const isWrap = WRAP_TEXT_COLS.has(key);
                          const alignCls = isCenter ? 'text-center' : isRight ? 'text-right' : 'text-left';
                          const wrapCls = isWrap
                            ? wrapMode === 'truncate' ? 'truncate' : wrapMode === 'wrap2' ? 'line-clamp-2' : ''
                            : '';
                          const pinBg = isPin ? (selectedIds.has(tx.id) ? '#fce7e7' : isHovered ? '#fdf2f2' : '#fef9f9') : rowBg;
                          return (
                            <td key={key}
                              className={`${tdCls} ${alignCls} ${isLastPin ? 'border-r-2 border-red-200' : ''}`}
                              style={{ ...tdStyle(key, isPin, left, pinBg), paddingTop: 0, paddingBottom: 0 }}>
                              <div className={`flex items-center h-full px-1 ${isCenter ? 'justify-center' : isRight ? 'justify-end' : ''}`} style={{ height: h }}>
                                <div className={`${wrapCls} w-full ${isRight ? 'text-right' : ''}`}>{chiCellContent(key, tx)}</div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-gray-100">
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              {([10, 15, 30, 50, 100] as const).map(n => (
                <button key={n} onClick={() => { setLimit(n); setPage(1); }}
                  className={`px-2.5 py-1 text-xs font-medium transition border-r border-gray-200 last:border-r-0 ${limit === n ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                  {n}
                </button>
              ))}
            </div>
            <span>kết quả</span>
          </div>
          <span className="text-gray-200">·</span>
          <span>
            {total === 0 ? '0' : `${(page - 1) * limit + 1}–${Math.min(page * limit, total)}`}
            {' '}trên tổng <span className="font-semibold text-gray-600">{total}</span> phiếu chi
          </span>
          <span className="text-gray-200">·</span>
          <span className="font-semibold text-red-500">Tổng chi: {fmtMoney(summary.totalPayment)}</span>
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
                      className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition ${page === item ? 'bg-red-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>
                      {item}
                    </button>
              )}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs" title="Trang sau">›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs font-medium" title="Trang cuối">»</button>
          </div>
        )}
      </div>

      {showColModal && (
        <ChiColModal
          visibleCols={visibleCols} colOrder={colOrder} pinnedCount={pinnedCount} wrapMode={wrapMode}
          onSave={handleSaveColConfig} onClose={() => setShowColModal(false)}
        />
      )}

      {showConfirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Xác nhận hủy phiếu</p>
                <p className="text-sm text-gray-500 mt-0.5">Sẽ hủy <span className="font-semibold text-red-600">{selectedIds.size}</span> phiếu chi đã chọn. Thao tác này không thể hoàn tác.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmCancel(false)} className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition font-medium">Không, giữ lại</button>
              <button onClick={confirmBulkDelete} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition">Hủy phiếu</button>
            </div>
          </div>
        </div>
      )}
      {chonLoai && <ChonLoaiPhieu loai="chi" onClose={() => setChonLoai(false)} />}
    </div>
  );
}
