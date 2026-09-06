'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { partnersApi } from '@/lib/partners';

const RANK_LABEL: Record<string, string> = { new: 'Mới', normal: 'Thường', loyal: 'Thân thiết', vip: 'VIP' };
const RANK_STYLE: Record<string, string> = {
  new: 'text-gray-400 bg-gray-50 border border-gray-200',
  normal: 'text-sky-600 bg-sky-50 border border-sky-100',
  loyal: 'text-emerald-600 bg-emerald-50 border border-emerald-100',
  vip: 'text-amber-500 bg-amber-50 border border-amber-200',
};
const TYPE_STYLE: Record<string, string> = {
  customer: 'text-blue-600 bg-blue-50',
  supplier: 'text-violet-600 bg-violet-50',
  both: 'text-teal-600 bg-teal-50',
  freight: 'text-orange-600 bg-orange-50',
};
const TYPE_LABEL: Record<string, string> = {
  customer: 'Khách hàng',
  supplier: 'Nhà cung cấp',
  both: 'KH + NCC',
  freight: 'Đơn vị VC',
};

const PAGE_CONFIG = {
  customer: {
    title: 'Khách Hàng',
    subtitle: 'Quản lý danh sách khách hàng',
    btnLabel: 'Thêm khách hàng',
    emptyLabel: 'Chưa có khách hàng nào',
    emptyBtn: '+ Thêm khách hàng đầu tiên',
    csvName: 'khach-hang.csv',
    csvNameSelected: 'khach-hang-da-chon.csv',
  },
  supplier: {
    title: 'Nhà Cung Cấp',
    subtitle: 'Quản lý danh sách nhà cung cấp',
    btnLabel: 'Thêm nhà cung cấp',
    emptyLabel: 'Chưa có nhà cung cấp nào',
    emptyBtn: '+ Thêm nhà cung cấp đầu tiên',
    csvName: 'nha-cung-cap.csv',
    csvNameSelected: 'nha-cung-cap-da-chon.csv',
  },
  freight: {
    title: 'Đơn Vị Vận Chuyển',
    subtitle: 'Quản lý công ty vận chuyển',
    btnLabel: 'Thêm đơn vị VC',
    emptyLabel: 'Chưa có đơn vị vận chuyển nào',
    emptyBtn: '+ Thêm đơn vị VC đầu tiên',
    csvName: 'don-vi-vc.csv',
    csvNameSelected: 'don-vi-vc-da-chon.csv',
  },
};

const OVERVIEW_CONFIG = {
  title: 'Đối Tác',
  subtitle: 'Quản lý khách hàng và nhà cung cấp',
  btnLabel: 'Thêm đối tác',
  emptyLabel: 'Chưa có đối tác nào',
  emptyBtn: '+ Thêm đối tác đầu tiên',
  csvName: 'doi-tac.csv',
  csvNameSelected: 'doi-tac-da-chon.csv',
};


const ALL_COLS = [
  { key: 'Liên hệ',        label: 'Liên hệ (SĐT + Email)',   defaultOn: true  },
  { key: 'Tỉnh/TP',        label: 'Tỉnh / Thành phố',        defaultOn: true  },
  { key: 'Hạng',           label: 'Hạng khách hàng',         defaultOn: true  },
  { key: 'Hạn mức CN',     label: 'Hạn mức công nợ',         defaultOn: true  },
  { key: 'Công nợ',        label: 'Công nợ hiện tại',        defaultOn: true  },
  { key: 'Tổng đơn hàng',  label: 'Tổng SL đơn hàng',       defaultOn: false },
  { key: 'Tổng chi tiêu',  label: 'Tổng chi tiêu',           defaultOn: false },
  { key: 'Người liên hệ',  label: 'Người liên hệ',           defaultOn: false },
  { key: 'Nguồn',          label: 'Nguồn khách',             defaultOn: false },
  { key: 'Nhóm',           label: 'Nhóm đối tác',            defaultOn: false },
  { key: 'Địa chỉ',        label: 'Địa chỉ',                 defaultOn: false },
  { key: 'Ngân hàng',      label: 'Tài khoản ngân hàng',     defaultOn: false },
  { key: 'Nhân viên PT',   label: 'Nhân viên phụ trách',     defaultOn: false },
] as const;

type ColKey = typeof ALL_COLS[number]['key'];

const defaultVisibility = Object.fromEntries(
  ALL_COLS.map((c) => [c.key, c.defaultOn])
) as Record<ColKey, boolean>;

interface Partner {
  id: number; code: string; name: string; type: string; customerType: string;
  phone?: string; email?: string; province?: string; rank: string;
  creditLimit: number; totalDebt: number; supplierDebt?: number; isActive: boolean;
  totalOrders: number; totalRevenue: number;
  contactPerson?: string; source?: string; group?: string;
  address?: string; bankAccount?: string; bankName?: string;
  assignedStaff?: { id: number; name: string };
}
interface Stats {
  total: number; customers: number; suppliers: number; freight: number; vip: number;
  customersWithDebt: number; totalCustomerDebt: number;
  suppliersWithDebt: number; totalSupplierDebt: number;
  freightWithDebt: number; totalFreightDebt: number;
  domesticSuppliers: number; foreignSuppliers: number;
  debtVnd: number; debtCnyForeign: number; debtCnyVnd: number;
  debtUsdForeign: number; debtUsdVnd: number;
}

type SortField = 'name' | 'totalDebt' | 'creditLimit' | 'rank' | 'totalOrders' | 'totalRevenue' | 'createdAt';

function ProvinceSelect({ value, onChange, provinces }: { value: string[]; onChange: (v: string[]) => void; provinces: string[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => provinces.filter((p) => p.toLowerCase().includes(q.toLowerCase())),
    [provinces, q],
  );

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setQ('');
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function toggle(p: string) {
    onChange(value.includes(p) ? value.filter((v) => v !== p) : [...value, p]);
  }

  const label = value.length === 0 ? 'Tỉnh / TP'
    : value.length === 1 ? value[0]
    : `${value.length} tỉnh/TP`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setTimeout(() => inputRef.current?.focus(), 50); }}
        className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm transition bg-gray-50/80 cursor-pointer min-w-[130px] ${
          value.length > 0 ? 'border-blue-400 text-blue-600 bg-blue-50/60' : 'border-gray-200 text-gray-500 hover:border-gray-300'
        }`}>
        <svg className="w-3 h-3 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        <span className="truncate flex-1 text-left">{label}</span>
        {value.length > 0
          ? <span onClick={(e) => { e.stopPropagation(); onChange([]); }}
              className="text-blue-400 hover:text-blue-600 ml-0.5 flex-shrink-0">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </span>
          : <svg className={`w-3 h-3 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
        }
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-100 rounded-xl shadow-xl w-56 py-2">
          {/* Search input */}
          <div className="px-2 pb-1.5">
            <div className="relative">
              <svg className="w-3 h-3 text-gray-300 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input ref={inputRef} type="text" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm tỉnh/TP..."
                className="w-full pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-300"/>
            </div>
          </div>
          {/* Selected chips */}
          {value.length > 0 && (
            <div className="px-2 pb-1.5 flex flex-wrap gap-1">
              {value.map((p) => (
                <span key={p} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-[11px] px-2 py-0.5 rounded-full font-medium">
                  {p}
                  <button onClick={() => toggle(p)} className="hover:text-blue-900">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="h-px bg-gray-50 mx-2 mb-1" />
          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
            {filtered.length === 0
              ? <p className="px-3 py-3 text-xs text-gray-300 text-center">Không tìm thấy</p>
              : filtered.map((p) => {
                  const checked = value.includes(p);
                  return (
                    <label key={p} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition ${checked ? 'bg-blue-50/60' : 'hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(p)}
                        className="w-3.5 h-3.5 rounded border-gray-300 accent-blue-600 cursor-pointer flex-shrink-0"/>
                      <span className={`text-sm ${checked ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>{p}</span>
                    </label>
                  );
                })
            }
          </div>
          {value.length > 0 && (
            <div className="px-2 pt-1.5 border-t border-gray-50 mt-1">
              <button onClick={() => onChange([])}
                className="w-full text-xs text-gray-400 hover:text-red-400 transition py-1">
                Xóa tất cả ({value.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SortTh({
  label, field, sortBy, sortOrder, onSort,
}: { label: string; field: SortField; sortBy: SortField; sortOrder: 'ASC' | 'DESC'; onSort: (f: SortField) => void }) {
  const active = sortBy === field;
  return (
    <th
      onClick={() => onSort(field)}
      className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 cursor-pointer select-none hover:text-gray-700 transition-colors group">
      <div className="flex items-center gap-1">
        {label}
        <span className={`flex flex-col leading-none ml-0.5 ${active ? 'text-blue-500' : 'text-gray-300 group-hover:text-gray-400'}`}>
          <svg className={`w-2.5 h-2.5 -mb-0.5 transition-opacity ${active && sortOrder === 'ASC' ? 'opacity-100' : 'opacity-40'}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 0L10 6H0L5 0z"/></svg>
          <svg className={`w-2.5 h-2.5 transition-opacity ${active && sortOrder === 'DESC' ? 'opacity-100' : 'opacity-40'}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 6L0 0H10L5 6z"/></svg>
        </span>
      </div>
    </th>
  );
}

function PlainTh({ label }: { label: string }) {
  return (
    <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">{label}</th>
  );
}

export default function PartnersListPage({ fixedTypeGroup }: { fixedTypeGroup?: 'customer' | 'supplier' | 'freight' }) {
  const router = useRouter();
  const cfg = fixedTypeGroup ? PAGE_CONFIG[fixedTypeGroup] : OVERVIEW_CONFIG;
  const colsKey = `partners_cols_${fixedTypeGroup || 'all'}`;

  const [partners, setPartners] = useState<Partner[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0, customers: 0, suppliers: 0, freight: 0, vip: 0,
    customersWithDebt: 0, totalCustomerDebt: 0,
    suppliersWithDebt: 0, totalSupplierDebt: 0,
    freightWithDebt: 0, totalFreightDebt: 0,
    domesticSuppliers: 0, foreignSuppliers: 0,
    debtVnd: 0, debtCnyForeign: 0, debtCnyVnd: 0,
    debtUsdForeign: 0, debtUsdVnd: 0,
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState<20 | 50 | 100>(20);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [showRankPicker, setShowRankPicker] = useState(false);
  const bulkMenuRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterRank, setFilterRank] = useState('');
  const [filterProvince, setFilterProvince] = useState<string[]>([]);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [topDebt, setTopDebt] = useState<{ receivable: Partner[]; payable: Partner[] }>({ receivable: [], payable: [] });
  const [showColMenu, setShowColMenu] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>(() => {
    try {
      const saved = localStorage.getItem(colsKey);
      if (saved) return { ...defaultVisibility, ...JSON.parse(saved) };
    } catch {}
    return defaultVisibility;
  });
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setShowColMenu(false);
      }
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(e.target as Node)) {
        setShowBulkMenu(false);
        setShowRankPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    partnersApi.getProvinces().then(setProvinces).catch(() => {});
    if (!fixedTypeGroup) {
      partnersApi.getTopDebt(10).then(setTopDebt).catch(() => {});
    }
  }, [fixedTypeGroup]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { sortBy, sortOrder, page: String(page), limit: String(limit) };
      if (search) params.search = search;
      if (fixedTypeGroup) {
        params.typeGroup = fixedTypeGroup;
      } else {
        if (filterType) params.type = filterType;
      }
      if (filterRank) params.rank = filterRank;
      if (filterProvince.length > 0) params.province = filterProvince.join(',');
      const [res, s] = await Promise.all([partnersApi.getAll(params), partnersApi.getStats()]);
      setPartners(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages || 1);
      setStats(s);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterRank, filterProvince.join(','), sortBy, sortOrder, page, limit, fixedTypeGroup]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  function handleSort(field: SortField) {
    setPage(1);
    if (sortBy === field) {
      setSortOrder((o) => o === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
  }

  function setSearchReset(v: string) { setPage(1); setSearch(v); }
  function setTypeReset(v: string) { setPage(1); setFilterType(v); }
  function setRankReset(v: string) { setPage(1); setFilterRank(v); }
  function setProvinceReset(v: string[]) { setPage(1); setFilterProvince(v); }

  function handleAdd() {
    const typeParam = fixedTypeGroup ? `?type=${fixedTypeGroup}` : '';
    router.push(`/dashboard/partners/new${typeParam}`);
  }
  function handleEdit(p: Partner) { router.push(`/dashboard/partners/${p.id}/edit`); }
  async function handleDelete(id: number) {
    if (!confirm('Xác nhận xóa đối tác này?')) return;
    await partnersApi.remove(id);
    load();
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === partners.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(partners.map((p) => p.id)));
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Xác nhận xóa ${selectedIds.size} đối tác đã chọn?`)) return;
    await Promise.all([...selectedIds].map((id) => partnersApi.remove(id)));
    setShowBulkMenu(false);
    load();
  }

  async function handleBulkRank(rank: string) {
    await Promise.all([...selectedIds].map((id) => partnersApi.update(id, { rank })));
    setShowBulkMenu(false);
    setShowRankPicker(false);
    load();
  }

  function exportSelectedCSV() {
    const selected = partners.filter((p) => selectedIds.has(p.id));
    const headers = ['Mã', 'Tên', 'Loại', 'SĐT', 'Email', 'Tỉnh/TP', 'Hạng', 'Hạn mức CN', 'Công nợ'];
    const rows = selected.map((p) => [
      p.code, p.name, TYPE_LABEL[p.type] || p.type,
      p.phone || '', p.email || '', p.province || '',
      RANK_LABEL[p.rank] || p.rank, p.creditLimit ?? 0, p.totalDebt ?? 0,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = cfg.csvNameSelected; a.click();
    URL.revokeObjectURL(url);
    setShowBulkMenu(false);
  }

  function toggleCol(col: ColKey) {
    setVisibleCols((prev) => {
      const next = { ...prev, [col]: !prev[col] };
      try { localStorage.setItem(colsKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function resetCols() {
    setVisibleCols(defaultVisibility);
    try { localStorage.removeItem(colsKey); } catch {}
  }

  function exportCSV() {
    const headers = ['Mã', 'Tên', 'Loại', 'SĐT', 'Email', 'Người liên hệ', 'Tỉnh/TP', 'Địa chỉ', 'Hạng', 'Nguồn', 'Hạn mức CN', 'Công nợ', 'Ngân hàng'];
    const rows = partners.map((p) => [
      p.code, p.name, TYPE_LABEL[p.type] || p.type,
      p.phone || '', p.email || '', p.contactPerson || '',
      p.province || '', p.address || '',
      RANK_LABEL[p.rank] || p.rank, p.source || '',
      p.creditLimit ?? 0, p.totalDebt ?? 0,
      p.bankAccount ? `${p.bankAccount} ${p.bankName || ''}`.trim() : '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = cfg.csvName; a.click();
    URL.revokeObjectURL(url);
  }

  const visibleCount = 3 + ALL_COLS.filter((c) => visibleCols[c.key]).length;

  const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ';

  // KPI cards — mỗi trang chỉ hiện số liệu liên quan
  type KpiCard = { label: string; value: string | number; sub?: string; iconColor: string; numColor: string; icon: React.ReactNode };
  const kpiCards: KpiCard[] = fixedTypeGroup === 'customer' ? [
    { label: 'Tổng khách hàng', value: stats.customers, iconColor: 'text-blue-400', numColor: 'text-blue-600',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /> },
    { label: 'Hạng VIP', value: stats.vip, iconColor: 'text-amber-400', numColor: 'text-amber-600',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /> },
    { label: 'Khách có công nợ', value: stats.customersWithDebt, sub: `/ ${stats.customers} khách`, iconColor: 'text-rose-400', numColor: 'text-rose-600',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
    { label: 'Tổng công nợ KH', value: fmt(stats.totalCustomerDebt), iconColor: 'text-red-400', numColor: 'text-red-600',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /> },
  ] : fixedTypeGroup === 'supplier' ? [
    { label: 'Tổng nhà cung cấp', value: stats.suppliers, iconColor: 'text-violet-400', numColor: 'text-violet-600',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /> },
    { label: 'NCC trong nước', value: stats.domesticSuppliers, iconColor: 'text-teal-400', numColor: 'text-teal-600',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /> },
    { label: 'NCC nước ngoài', value: stats.foreignSuppliers, iconColor: 'text-sky-400', numColor: 'text-sky-600',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
    { label: 'Tổng nợ NCC', value: fmt(stats.totalSupplierDebt), iconColor: 'text-red-400', numColor: 'text-red-600',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /> },
  ] : fixedTypeGroup === 'freight' ? [
    { label: 'Tổng đơn vị VC', value: stats.freight, iconColor: 'text-orange-400', numColor: 'text-orange-600',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /> },
    { label: 'Đơn vị có công nợ', value: stats.freightWithDebt, sub: `/ ${stats.freight} đơn vị`, iconColor: 'text-rose-400', numColor: 'text-rose-600',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
    { label: 'Tổng công nợ phải trả', value: fmt(stats.totalFreightDebt), iconColor: 'text-red-400', numColor: 'text-red-600',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /> },
  ] : [];

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Page header */}
      <div className="bg-white border-b border-gray-100 px-7 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-gray-900 tracking-tight">{cfg.title}</h1>
          <p className="text-gray-400 text-xs mt-0.5">{cfg.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV}
            className="inline-flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 active:scale-95 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Xuất CSV
          </button>
          <button onClick={handleAdd}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-sm shadow-blue-200">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            {cfg.btnLabel}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
        {/* KPI cards */}
        {!fixedTypeGroup ? (
          /* Trang tổng quan — layout tài chính với CN phải trả tách tiền tệ */
          (() => {
            const net = stats.totalCustomerDebt - stats.totalSupplierDebt - stats.totalFreightDebt;
            const totalPayableVnd = stats.totalSupplierDebt + stats.totalFreightDebt;
            const fmtCny = (n: number) => '¥' + n.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
            const fmtUsd = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
            return (
              <div className="grid grid-cols-3 gap-3">
                {/* CN phải thu */}
                <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-rose-500 to-rose-700 shadow-sm shadow-rose-200 flex items-center gap-2 px-3 py-2">
                  <div className="w-6 h-6 rounded-md bg-white/15 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 font-medium leading-none">CN phải thu (KH nợ)</p>
                    <p className="text-base font-bold text-white mt-0.5 leading-none truncate">{fmt(stats.totalCustomerDebt)}</p>
                    <p className="text-[10px] text-white/50 mt-0.5 leading-none">{stats.customersWithDebt} khách hàng</p>
                  </div>
                </div>

                {/* CN phải trả — tách loại tiền */}
                <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 shadow-sm shadow-violet-200 flex items-center gap-2 px-3 py-2">
                  <div className="w-6 h-6 rounded-md bg-white/15 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/></svg>
                  </div>
                  <div className="z-10 min-w-0 flex-1">
                    <p className="text-[10px] text-gray-400 font-medium leading-none">CN phải trả · {stats.suppliersWithDebt + stats.freightWithDebt} đối tác</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {stats.debtVnd > 0 && (
                        <p className="text-sm font-bold text-white leading-none">{fmt(stats.debtVnd)}</p>
                      )}
                      {stats.debtCnyForeign > 0 && (
                        <span className="inline-flex items-center gap-1 bg-white/15 rounded px-1.5 py-0.5">
                          <span className="text-[10px] text-yellow-200 font-semibold">CNY</span>
                          <span className="text-xs font-bold text-yellow-100">{fmtCny(stats.debtCnyForeign)}</span>
                        </span>
                      )}
                      {stats.debtUsdForeign > 0 && (
                        <span className="inline-flex items-center gap-1 bg-white/15 rounded px-1.5 py-0.5">
                          <span className="text-[10px] text-green-200 font-semibold">USD</span>
                          <span className="text-xs font-bold text-green-100">{fmtUsd(stats.debtUsdForeign)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Công nợ ròng */}
                {(() => {
                  const isPos = net >= 0;
                  return (
                    <div className={`relative overflow-hidden rounded-lg bg-gradient-to-br ${isPos ? 'from-emerald-500 to-emerald-700 shadow-emerald-200' : 'from-orange-500 to-red-600 shadow-orange-200'} shadow-sm flex items-center gap-2 px-3 py-2`}>
                      <div className="w-6 h-6 rounded-md bg-white/15 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-400 font-medium leading-none">Công nợ ròng</p>
                        <p className="text-base font-bold text-white mt-0.5 leading-none truncate">{(isPos ? '+' : '') + fmt(net)}</p>
                        <p className="text-[10px] text-white/50 mt-0.5 leading-none">{isPos ? 'Có lợi' : 'Cần chú ý'}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()
        ) : (
          <div className={`grid gap-3 ${kpiCards.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {kpiCards.map((k) => (
              <div key={k.label} className="bg-white rounded-lg border border-gray-100 shadow-sm flex items-center gap-2 px-3 py-2">
                <div className="w-6 h-6 rounded-md bg-gray-50 flex items-center justify-center flex-shrink-0">
                  <svg className={`w-3 h-3 ${k.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">{k.icon}</svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 font-medium leading-none">{k.label}</p>
                  <p className={`text-base font-bold mt-0.5 leading-none truncate ${k.numColor}`}>{k.value}</p>
                  {k.sub && <p className="text-[10px] text-gray-400/60 mt-0.5 leading-none">{k.sub}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Trang tổng quan: 2 bảng top công nợ */}
        {!fixedTypeGroup && (
          <div className="grid grid-cols-2 gap-4">
            {/* Top công nợ phải thu */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-400" />
                  <h3 className="text-sm font-semibold text-gray-800">Top công nợ phải thu</h3>
                  <span className="text-[11px] text-gray-400">(KH đang nợ)</span>
                </div>
                <a href="/dashboard/partners/khach-hang" className="text-[11px] text-blue-500 hover:underline font-medium">Xem tất cả →</a>
              </div>
              {topDebt.receivable.length === 0 ? (
                <div className="py-10 text-center text-gray-300 text-sm">Không có công nợ</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/60">
                      <th className="text-left px-5 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Đối tác</th>
                      <th className="text-right px-5 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Công nợ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDebt.receivable.map((p, i) => (
                      <tr key={p.id} className="border-t border-gray-50 hover:bg-rose-50/30 transition-colors">
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="text-[11px] text-gray-300 w-4 text-center font-medium">{i + 1}</span>
                            <div>
                              <a href={`/dashboard/partners/${p.id}`} className="font-medium text-gray-800 hover:text-blue-600 text-[13px] transition">{p.name}</a>
                              <div className="text-[11px] text-gray-400">{p.code} · {p.phone || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          {(() => {
                            const debt = Number(p.totalDebt);
                            const limit = Number(p.creditLimit);
                            const overLimit = limit > 0 && debt > limit;
                            return (
                              <>
                                <span className={`font-semibold text-[13px] ${overLimit ? 'text-red-500' : 'text-emerald-500'}`}>
                                  {debt.toLocaleString('vi-VN')}đ
                                </span>
                                {limit > 0 && (
                                  <div className={`text-[10px] mt-0.5 ${overLimit ? 'text-red-400 font-medium' : 'text-gray-400'}`}>
                                    HM: {limit.toLocaleString('vi-VN')}đ{overLimit && ' ⚠ Vượt'}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Top công nợ phải trả */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-violet-400" />
                  <h3 className="text-sm font-semibold text-gray-800">Top công nợ phải trả</h3>
                  <span className="text-[11px] text-gray-400">(mình đang nợ)</span>
                </div>
                <a href="/dashboard/partners/nha-cung-cap" className="text-[11px] text-blue-500 hover:underline font-medium">Xem NCC →</a>
              </div>
              {topDebt.payable.length === 0 ? (
                <div className="py-10 text-center text-gray-300 text-sm">Không có công nợ</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/60">
                      <th className="text-left px-5 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Đối tác</th>
                      <th className="text-right px-5 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Công nợ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDebt.payable.map((p, i) => (
                      <tr key={p.id} className="border-t border-gray-50 hover:bg-violet-50/30 transition-colors">
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="text-[11px] text-gray-300 w-4 text-center font-medium">{i + 1}</span>
                            <div>
                              <a href={`/dashboard/partners/${p.id}`} className="font-medium text-gray-800 hover:text-blue-600 text-[13px] transition">{p.name}</a>
                              <div className="text-[11px] text-gray-400">
                                {p.code} · <span className={`${TYPE_STYLE[p.type]} px-1.5 py-0.5 rounded text-[10px]`}>{TYPE_LABEL[p.type]}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <span className="font-semibold text-violet-600 text-[13px]">
                            {Number(p.supplierDebt ?? 0).toLocaleString('vi-VN')}đ
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Main card — chỉ hiện ở trang con */}
        {fixedTypeGroup && <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-5 py-2.5 bg-blue-50 border-b border-blue-100">
              <span className="text-sm font-semibold text-blue-700">
                Đã chọn <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-md">{selectedIds.size}</span> đối tác
              </span>
              <div className="relative" ref={bulkMenuRef}>
                <button
                  onClick={() => { setShowBulkMenu((v) => !v); setShowRankPicker(false); }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-blue-200 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-50 transition shadow-sm">
                  Chọn thao tác
                  <svg className={`w-3.5 h-3.5 transition-transform ${showBulkMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showBulkMenu && (
                  <div className="absolute left-0 top-full mt-1.5 z-50 bg-white shadow-xl rounded-xl border border-gray-100 w-52 py-1.5">
                    <button onClick={exportSelectedCSV}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Xuất CSV đã chọn
                    </button>
                    <div className="h-px bg-gray-100 mx-3 my-1" />
                    <div>
                      <button
                        onClick={() => setShowRankPicker((v) => !v)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">
                        <div className="flex items-center gap-3">
                          <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                          Cập nhật hạng
                        </div>
                        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showRankPicker ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      {showRankPicker && (
                        <div className="bg-gray-50 mx-2 mb-1 rounded-lg overflow-hidden">
                          {[
                            { value: 'new',    label: 'Mới',        color: 'text-gray-500' },
                            { value: 'normal', label: 'Thường',     color: 'text-sky-600'  },
                            { value: 'loyal',  label: 'Thân thiết', color: 'text-emerald-600' },
                            { value: 'vip',    label: '★ VIP',      color: 'text-amber-500' },
                          ].map((r) => (
                            <button key={r.value} onClick={() => handleBulkRank(r.value)}
                              className={`w-full text-left px-4 py-2 text-sm font-medium ${r.color} hover:bg-white transition`}>
                              {r.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="h-px bg-gray-100 mx-3 my-1" />
                    <button onClick={handleBulkDelete}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Xóa đã chọn
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => setSelectedIds(new Set())}
                className="ml-auto text-xs text-blue-400 hover:text-blue-600 flex items-center gap-1 transition font-medium">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Bỏ chọn tất cả
              </button>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-50">
            {/* Column toggle */}
            <div className="relative" ref={colMenuRef}>
              <button onClick={() => setShowColMenu((v) => !v)}
                className={`w-8 h-8 flex items-center justify-center border rounded-lg transition ${showColMenu ? 'border-blue-300 bg-blue-50 text-blue-500' : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                title="Tùy chỉnh cột hiển thị">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              {showColMenu && (
                <div className="absolute left-0 top-full mt-1.5 z-50 bg-white shadow-2xl rounded-xl border border-gray-100 w-64 py-2" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                  <div className="flex items-center justify-between px-4 pt-1 pb-2 sticky top-0 bg-white border-b border-gray-50">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Hiển thị cột</p>
                    <button onClick={resetCols} className="text-[11px] text-blue-500 hover:underline font-medium">Mặc định</button>
                  </div>
                  {ALL_COLS.map((col) => (
                    <label key={col.key} className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/50 cursor-pointer">
                      <input type="checkbox" checked={visibleCols[col.key]} onChange={() => toggleCol(col.key)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer accent-blue-600" />
                      <span className="text-sm text-gray-700">{col.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <svg className="w-3.5 h-3.5 text-gray-300 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Tên, SĐT, mã..." value={search}
                onChange={(e) => setSearchReset(e.target.value)}
                className="pl-8 pr-4 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48 bg-gray-50/80 placeholder:text-gray-300" />
            </div>

            {/* Province searchable dropdown — tự cập nhật từ DB */}
            <ProvinceSelect value={filterProvince} onChange={setProvinceReset} provinces={provinces} />

            {/* Type filter — chỉ hiện ở trang tổng quan */}
            {!fixedTypeGroup && (
              <select value={filterType} onChange={(e) => setTypeReset(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/80 cursor-pointer">
                <option value="">Tất cả loại</option>
                <option value="customer">Khách hàng</option>
                <option value="supplier">Nhà cung cấp</option>
                <option value="both">KH + NCC</option>
                <option value="freight">Đơn vị VC</option>
              </select>
            )}

            <select value={filterRank} onChange={(e) => setRankReset(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/80 cursor-pointer">
              <option value="">Tất cả hạng</option>
              <option value="new">Mới</option>
              <option value="normal">Thường</option>
              <option value="loyal">Thân thiết</option>
              <option value="vip">VIP</option>
            </select>

            {(search || filterType || filterRank || filterProvince.length > 0) && (
              <button onClick={() => { setPage(1); setSearch(''); setFilterType(''); setFilterRank(''); setFilterProvince([]); }}
                className="text-xs text-gray-300 hover:text-red-400 transition flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Xóa lọc
              </button>
            )}

            <span className="ml-auto text-xs text-gray-300">{total} kết quả</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-max">
            <thead>
              <tr className="bg-gray-50">
                <th className="w-10 pl-4 py-2.5 border-b border-gray-100">
                  <input type="checkbox"
                    checked={partners.length > 0 && selectedIds.size === partners.length}
                    ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < partners.length; }}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer" />
                </th>
                <PlainTh label="Mã" />
                <SortTh label="Tên đối tác" field="name" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                {visibleCols['Liên hệ'] && <PlainTh label="Liên hệ" />}
                {visibleCols['Người liên hệ'] && <PlainTh label="Người liên hệ" />}
                {visibleCols['Tỉnh/TP'] && <PlainTh label="Tỉnh/TP" />}
                {visibleCols['Địa chỉ'] && <PlainTh label="Địa chỉ" />}
                {visibleCols['Hạng'] && <SortTh label="Hạng" field="rank" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                {visibleCols['Nguồn'] && <PlainTh label="Nguồn" />}
                {visibleCols['Nhóm'] && <PlainTh label="Nhóm" />}
                {visibleCols['Hạn mức CN'] && <SortTh label="Hạn mức CN" field="creditLimit" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                {visibleCols['Công nợ'] && <SortTh label="Công nợ" field="totalDebt" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                {visibleCols['Tổng đơn hàng'] && <SortTh label="Tổng đơn hàng" field="totalOrders" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                {visibleCols['Tổng chi tiêu'] && <SortTh label="Tổng chi tiêu" field="totalRevenue" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                {visibleCols['Ngân hàng'] && <PlainTh label="Ngân hàng" />}
                {visibleCols['Nhân viên PT'] && <PlainTh label="Nhân viên PT" />}
                <th className="border-b border-gray-100 w-24" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={visibleCount} className="text-center py-14">
                  <div className="inline-flex flex-col items-center gap-2 text-gray-300">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <span className="text-xs">Đang tải...</span>
                  </div>
                </td></tr>
              ) : partners.length === 0 ? (
                <tr><td colSpan={visibleCount} className="text-center py-14">
                  <svg className="w-10 h-10 mx-auto text-gray-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-gray-300 text-sm">{cfg.emptyLabel}</p>
                  <button onClick={handleAdd} className="mt-2 text-blue-500 text-xs hover:underline font-medium">{cfg.emptyBtn}</button>
                </td></tr>
              ) : partners.map((p) => (
                <tr key={p.id} className={`border-b border-gray-50 last:border-0 transition-colors group ${selectedIds.has(p.id) ? 'bg-blue-50/40' : 'hover:bg-blue-50/20'}`}>
                  <td className="w-10 pl-4 py-3.5">
                    <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)}
                      className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer" />
                  </td>
                  <td className="px-5 py-3.5">
                    <Link href={`/dashboard/partners/${p.id}`}
                      className="font-mono text-[11px] bg-blue-50 text-blue-500 hover:bg-blue-100 px-2 py-1 rounded-md tracking-wide transition">
                      {p.code}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <Link href={`/dashboard/partners/${p.id}`}
                      className="font-semibold text-gray-800 text-sm hover:text-blue-600 transition block">
                      {p.name}
                    </Link>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${TYPE_STYLE[p.type] || 'text-gray-500 bg-gray-50'}`}>
                        {TYPE_LABEL[p.type] || p.type}
                      </span>
                      <span className="text-[11px] text-gray-300">{p.customerType === 'individual' ? 'Cá nhân' : 'Doanh nghiệp'}</span>
                    </div>
                  </td>
                  {visibleCols['Liên hệ'] && (
                    <td className="px-5 py-3.5">
                      <div className="text-gray-700 text-sm">{p.phone || <span className="text-gray-200">—</span>}</div>
                      {p.email && <div className="text-[11px] text-gray-400 mt-0.5">{p.email}</div>}
                    </td>
                  )}
                  {visibleCols['Người liên hệ'] && (
                    <td className="px-5 py-3.5 text-sm text-gray-600">{p.contactPerson || <span className="text-gray-200">—</span>}</td>
                  )}
                  {visibleCols['Tỉnh/TP'] && (
                    <td className="px-5 py-3.5 text-sm text-gray-600">{p.province || <span className="text-gray-200">—</span>}</td>
                  )}
                  {visibleCols['Địa chỉ'] && (
                    <td className="px-5 py-3.5 text-sm text-gray-600 max-w-[160px]">
                      <span className="truncate block">{p.address || <span className="text-gray-200">—</span>}</span>
                    </td>
                  )}
                  {visibleCols['Hạng'] && (
                    <td className="px-5 py-3.5">
                      <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${RANK_STYLE[p.rank]}`}>
                        {p.rank === 'vip' && '★ '}{RANK_LABEL[p.rank]}
                      </span>
                    </td>
                  )}
                  {visibleCols['Nguồn'] && (
                    <td className="px-5 py-3.5 text-sm text-gray-600">{p.source || <span className="text-gray-200">—</span>}</td>
                  )}
                  {visibleCols['Nhóm'] && (
                    <td className="px-5 py-3.5 text-sm text-gray-600">{p.group || <span className="text-gray-200">—</span>}</td>
                  )}
                  {visibleCols['Hạn mức CN'] && (
                    <td className="px-5 py-3.5 text-sm">
                      {Number(p.creditLimit) > 0
                        ? <span className="text-gray-700 font-medium">{Number(p.creditLimit).toLocaleString('vi-VN')}đ</span>
                        : <span className="text-gray-200">—</span>}
                    </td>
                  )}
                  {visibleCols['Công nợ'] && (
                    <td className="px-5 py-3.5 text-sm">
                      {Number(p.totalDebt) > 0
                        ? <span className="text-red-500 font-semibold">{Number(p.totalDebt).toLocaleString('vi-VN')}đ</span>
                        : <span className="text-gray-300">0đ</span>}
                    </td>
                  )}
                  {visibleCols['Tổng đơn hàng'] && (
                    <td className="px-5 py-3.5 text-sm text-center">
                      {(p.totalOrders || 0) > 0
                        ? <span className="font-semibold text-gray-700">{p.totalOrders}</span>
                        : <span className="text-gray-300">0</span>}
                    </td>
                  )}
                  {visibleCols['Tổng chi tiêu'] && (
                    <td className="px-5 py-3.5 text-sm">
                      {Number(p.totalRevenue) > 0
                        ? <span className="font-semibold text-emerald-600">{Number(p.totalRevenue).toLocaleString('vi-VN')}đ</span>
                        : <span className="text-gray-300">0đ</span>}
                    </td>
                  )}
                  {visibleCols['Ngân hàng'] && (
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {p.bankAccount
                        ? <div><div className="font-mono text-xs">{p.bankAccount}</div><div className="text-[11px] text-gray-400">{p.bankName}</div></div>
                        : <span className="text-gray-200">—</span>}
                    </td>
                  )}
                  {visibleCols['Nhân viên PT'] && (
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {p.assignedStaff
                        ? <span className="inline-flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                              {p.assignedStaff.name.charAt(0)}
                            </span>
                            {p.assignedStaff.name}
                          </span>
                        : <span className="text-gray-200">—</span>}
                    </td>
                  )}
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(p)}
                        className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium transition">Sửa</button>
                      <button onClick={() => handleDelete(p.id)}
                        className="px-3 py-1.5 text-xs bg-red-50 text-red-400 hover:bg-red-100 rounded-lg font-medium transition">Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>Hiển thị</span>
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                  {([20, 50, 100] as const).map((n) => (
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
                {total === 0 ? '0' : `${(page - 1) * limit + 1}–${Math.min(page * limit, total)}`}
                {' '}trên tổng <span className="font-semibold text-gray-600">{total}</span> đối tác
              </span>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs font-medium">«</button>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs">‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === 'ellipsis'
                      ? <span key={`e${idx}`} className="w-7 h-7 flex items-center justify-center text-gray-300 text-xs">…</span>
                      : <button key={item} onClick={() => setPage(item as number)}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition ${page === item ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>{item}</button>
                  )}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs">›</button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs font-medium">»</button>
              </div>
            )}
          </div>
        </div>}
      </div>
    </div>
  );
}
