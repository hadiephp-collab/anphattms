'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { returnsApi } from '@/lib/returns';
import { localDateStr } from '@/lib/utils';

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface ReturnItem { productName: string; quantity: number; }
interface ReturnRecord {
  id: number; code: string; createdAt: string; updatedAt: string;
  status: string; refundMethod: string; totalRefund: number;
  reason: string | null; notes: string | null; rejectReason: string | null;
  processedAt: string | null;
  order: { id: number; code: string } | null;
  customer: { id: number; name: string; phone: string | null } | null;
  processedBy: { id: number; fullName: string | null; username: string } | null;
  items: ReturnItem[];
}
interface Stats {
  todayCount: number; todayRefund: number; pending: number;
  approvedThisMonth: number; approvedDelta: number;
  returnRateThisMonth: number; rateDelta: number;
  topReasons: { reason: string; count: number; percent: number }[];
  topProducts: { productCode: string; productName: string; totalQty: number }[];
}

// ─── Cột có thể bật/tắt ──────────────────────────────────────────────────────
const COL_GROUPS = [
  { group: 'Phiếu trả', cols: [
    { key: 'code',          label: 'Mã phiếu',      required: true },
    { key: 'createdAt',     label: 'Ngày tạo' },
    { key: 'updatedAt',     label: 'Ngày cập nhật' },
  ]},
  { group: 'Đơn hàng', cols: [
    { key: 'order',         label: 'Đơn gốc' },
  ]},
  { group: 'Khách hàng', cols: [
    { key: 'customer',      label: 'Khách hàng',    required: true },
    { key: 'customerPhone', label: 'SĐT khách' },
  ]},
  { group: 'Sản phẩm', cols: [
    { key: 'items',         label: 'Sản phẩm trả' },
  ]},
  { group: 'Tài chính', cols: [
    { key: 'totalRefund',   label: 'Tiền hoàn' },
    { key: 'refundMethod',  label: 'PT hoàn tiền' },
  ]},
  { group: 'Trạng thái', cols: [
    { key: 'status',        label: 'Trạng thái',    required: true },
  ]},
  { group: 'Xử lý', cols: [
    { key: 'processedBy',   label: 'Người xử lý' },
    { key: 'processedAt',   label: 'Ngày xử lý' },
    { key: 'rejectReason',  label: 'Lý do từ chối' },
  ]},
  { group: 'Ghi chú', cols: [
    { key: 'reason',        label: 'Lý do trả' },
    { key: 'notes',         label: 'Ghi chú' },
  ]},
];
const ALL_COLS    = COL_GROUPS.flatMap(g => g.cols);
const DEFAULT_COLS = new Set(['code','createdAt','order','customer','items','totalRefund','refundMethod','status']);
const REQUIRED_COLS = new Set(['code','customer','status']);

function loadCols(): Set<string> {
  try {
    const s = localStorage.getItem('returns_cols');
    if (s) { const saved = new Set<string>(JSON.parse(s)); REQUIRED_COLS.forEach(k => saved.add(k)); return saved; }
  } catch {}
  return new Set(DEFAULT_COLS);
}

// ─── Hằng số ─────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string,string> = {
  pending:'Chờ duyệt', approved:'Đã duyệt', rejected:'Từ chối', cancelled:'Đã huỷ',
};
const STATUS_STYLE: Record<string,string> = {
  pending:   'bg-amber-50 text-amber-600 border border-amber-100',
  approved:  'bg-emerald-50 text-emerald-600 border border-emerald-100',
  rejected:  'bg-red-50 text-red-500 border border-red-100',
  cancelled: 'bg-gray-50 text-gray-400 border border-gray-200',
};
const REFUND_LABEL: Record<string,string> = {
  cash:'Tiền mặt', bank_transfer:'Chuyển khoản', exchange:'Đổi hàng', no_refund:'Không hoàn',
};
const TABS = [
  { key:'',          label:'Tất cả' },
  { key:'pending',   label:'Chờ duyệt' },
  { key:'approved',  label:'Đã duyệt' },
  { key:'rejected',  label:'Từ chối' },
  { key:'cancelled', label:'Đã huỷ' },
  { key:'__analytics__', label:'Phân tích' },
];
const REASONS = [
  'Sản phẩm bị lỗi / hỏng','Không đúng với mô tả','Sản phẩm không đúng size / màu',
  'Khách hàng đổi ý','Giao nhầm sản phẩm','Hàng bị thiếu phụ kiện','Khác',
];
const DATE_PRESETS = [
  { key:'today',      label:'Hôm nay' },
  { key:'yesterday',  label:'Hôm qua' },
  { key:'this_week',  label:'Tuần này' },
  { key:'last_week',  label:'Tuần trước' },
  { key:'this_month', label:'Tháng này' },
  { key:'last_month', label:'Tháng trước' },
  { key:'custom',     label:'Tuỳ chọn' },
];

function presetToDates(preset: string): { from: string; to: string } {
  const today = new Date(); const fmt = localDateStr;
  if (preset === 'today')      return { from: fmt(today), to: fmt(today) };
  if (preset === 'yesterday')  { const d = new Date(today); d.setDate(d.getDate()-1); return { from: fmt(d), to: fmt(d) }; }
  if (preset === 'this_week')  { const d = new Date(today); d.setDate(d.getDate()-d.getDay()+1); return { from: fmt(d), to: fmt(today) }; }
  if (preset === 'last_week')  { const s = new Date(today); s.setDate(s.getDate()-s.getDay()-6); const e = new Date(s); e.setDate(e.getDate()+6); return { from: fmt(s), to: fmt(e) }; }
  if (preset === 'this_month') { const d = new Date(today.getFullYear(), today.getMonth(), 1); return { from: fmt(d), to: fmt(today) }; }
  if (preset === 'last_month') { const s = new Date(today.getFullYear(), today.getMonth()-1, 1); const e = new Date(today.getFullYear(), today.getMonth(), 0); return { from: fmt(s), to: fmt(e) }; }
  return { from:'', to:'' };
}

function fmt(n: number) { return n.toLocaleString('vi-VN'); }
function fmtDate(s: string) { return new Date(s).toLocaleDateString('vi-VN'); }

function SortIcon({ col, sortBy, sortOrder }: { col: string; sortBy: string; sortOrder: 'ASC'|'DESC' }) {
  const active = sortBy === col;
  return (
    <span className="inline-flex flex-col ml-1 opacity-60 align-middle">
      <svg className={`w-2.5 h-2.5 -mb-0.5 ${active && sortOrder==='ASC' ? 'opacity-100 text-blue-600' : 'opacity-30'}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 0L10 6H0z"/></svg>
      <svg className={`w-2.5 h-2.5 ${active && sortOrder==='DESC' ? 'opacity-100 text-blue-600' : 'opacity-30'}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 6L0 0H10z"/></svg>
    </span>
  );
}

// ─── Dropdown filter button component ────────────────────────────────────────
function FilterDropdown({ label, active, children }: { label: string; active: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border transition whitespace-nowrap ${
          active ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}>
        {label}
        {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-40 bg-white border border-gray-200 rounded-2xl shadow-xl min-w-[200px]"
          onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ReturnsPage() {
  const router = useRouter();
  const [records, setRecords]   = useState<ReturnRecord[]>([]);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab]           = useState('');
  const [search, setSearch]     = useState('');
  const [filterReason, setFilterReason]       = useState('');
  const [filterRefund, setFilterRefund]       = useState('');
  const [filterDatePreset, setFilterDatePreset] = useState('');
  const [filterFrom, setFilterFrom]           = useState('');
  const [filterTo, setFilterTo]               = useState('');
  const [customFrom, setCustomFrom]           = useState('');
  const [customTo, setCustomTo]               = useState('');
  const [showDateDrop, setShowDateDrop]       = useState(false);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [limit, setLimit]     = useState<20|50|100>(20);
  const [totalPages, setTotalPages] = useState(1);
  const [exporting, setExporting]   = useState(false);
  const [sortBy, setSortBy]         = useState('createdAt');
  const [sortOrder, setSortOrder]   = useState<'ASC'|'DESC'>('DESC');
  const [visibleCols, setVisibleCols]         = useState<Set<string>>(DEFAULT_COLS);
  const [showColSettings, setShowColSettings] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const dateDrop = useRef<HTMLDivElement>(null);

  useEffect(() => { setVisibleCols(loadCols()); }, []);
  useEffect(() => {
    function h(e: MouseEvent) { if (dateDrop.current && !dateDrop.current.contains(e.target as Node)) setShowDateDrop(false); }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);

  const has = (col: string) => visibleCols.has(col);

  function saveColSettings(cols: Set<string>) {
    setVisibleCols(cols);
    localStorage.setItem('returns_cols', JSON.stringify([...cols]));
    setShowColSettings(false);
  }

  const load = useCallback(async (
    s = search, p = page, st = tab,
    fr = filterReason, ff = filterRefund, df = filterFrom, dt = filterTo,
    lm: number = limit, sb = sortBy, so: 'ASC'|'DESC' = sortOrder,
  ) => {
    setLoading(true);
    try {
      const params: Record<string,string> = { page: String(p), limit: String(lm), sortBy: sb, sortOrder: so };
      if (st) params.status = st;
      if (s)  params.search = s;
      if (fr) params.reason = fr;
      if (ff) params.refundMethod = ff;
      if (df) params.dateFrom = df;
      if (dt) { const [y,mo,dy] = dt.split('-').map(Number); params.dateTo = localDateStr(new Date(y, mo-1, dy+1)); }
      const [res, st2] = await Promise.all([returnsApi.getAll(params), returnsApi.getStats()]);
      setRecords(res.items); setTotal(res.total); setTotalPages(res.totalPages); setStats(st2);
      setLoadError('');
    } catch (e: unknown) { setLoadError(e instanceof Error ? e.message : 'Không thể tải dữ liệu. Kiểm tra kết nối server.'); }
    setLoading(false);
  }, [search, page, tab, filterReason, filterRefund, filterFrom, filterTo, limit, sortBy, sortOrder]);

  useEffect(() => { load(); }, []); // eslint-disable-line

  function handleSearch(v: string) {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); load(v, 1, tab, filterReason, filterRefund, filterFrom, filterTo); }, 350);
  }
  function handleTab(t: string) {
    setTab(t);
    if (t !== '__analytics__') { setPage(1); load(search, 1, t, filterReason, filterRefund, filterFrom, filterTo, limit, sortBy, sortOrder); }
  }
  function handlePage(p: number) { setPage(p); load(search, p, tab, filterReason, filterRefund, filterFrom, filterTo, limit, sortBy, sortOrder); }
  function handleLimit(l: 20|50|100) { setLimit(l); setPage(1); load(search, 1, tab, filterReason, filterRefund, filterFrom, filterTo, l, sortBy, sortOrder); }
  function handleSort(col: string) {
    const newOrder = sortBy === col && sortOrder === 'DESC' ? 'ASC' : 'DESC';
    const newDir   = sortBy === col ? newOrder : 'DESC';
    setSortBy(col); setSortOrder(newDir); setPage(1);
    load(search, 1, tab, filterReason, filterRefund, filterFrom, filterTo, limit, col, newDir);
  }

  function applyDatePreset(preset: string) {
    setFilterDatePreset(preset);
    if (preset !== 'custom') {
      const { from, to } = presetToDates(preset);
      setFilterFrom(from); setFilterTo(to);
      setPage(1); load(search, 1, tab, filterReason, filterRefund, from, to);
      setShowDateDrop(false);
    }
  }
  function applyCustomDate() {
    setFilterFrom(customFrom); setFilterTo(customTo);
    setPage(1); load(search, 1, tab, filterReason, filterRefund, customFrom, customTo);
    setShowDateDrop(false);
  }
  function clearDate() {
    setFilterDatePreset(''); setFilterFrom(''); setFilterTo(''); setCustomFrom(''); setCustomTo('');
    setPage(1); load(search, 1, tab, filterReason, filterRefund, '', '');
  }
  function applyRefund(v: string) { setFilterRefund(v); setPage(1); load(search, 1, tab, filterReason, v, filterFrom, filterTo); }
  function applyReason(v: string) { setFilterReason(v); setPage(1); load(search, 1, tab, v, filterRefund, filterFrom, filterTo); }

  // Xuất CSV
  async function handleExport() {
    setExporting(true);
    try {
      const params: Record<string,string> = { page:'1', limit:'9999' };
      if (tab)          params.status = tab;
      if (search)       params.search = search;
      if (filterReason) params.reason = filterReason;
      if (filterRefund) params.refundMethod = filterRefund;
      if (filterFrom)   params.dateFrom = filterFrom;
      if (filterTo)     { const [y,mo,dy] = filterTo.split('-').map(Number); params.dateTo = localDateStr(new Date(y, mo-1, dy+1)); }
      const res = await returnsApi.getAll(params);
      const headers = ['Mã phiếu','Ngày tạo','Đơn gốc','Khách hàng','SĐT','Sản phẩm','Lý do trả','Tiền hoàn','PT hoàn','Trạng thái','Người xử lý','Ngày xử lý','Ghi chú'];
      const rows = (res.items as ReturnRecord[]).map(r => [
        r.code, fmtDate(r.createdAt), r.order?.code??'', r.customer?.name??'Khách lẻ', r.customer?.phone??'',
        r.items.map(i=>i.productName).join('; '), r.reason??'', r.totalRefund,
        REFUND_LABEL[r.refundMethod]??r.refundMethod, STATUS_LABEL[r.status]??r.status,
        r.processedBy?.fullName??r.processedBy?.username??'', r.processedAt?fmtDate(r.processedAt):'', r.notes??'',
      ]);
      const csv = [headers,...rows].map(row=>row.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download=`tra-hang-${localDateStr()}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch {/**/ }
    setExporting(false);
  }

  const dateLabel = filterDatePreset ? DATE_PRESETS.find(p=>p.key===filterDatePreset)?.label ?? 'Ngày tạo' : 'Ngày tạo';
  const refundLabel = filterRefund ? REFUND_LABEL[filterRefund] : 'PT hoàn tiền';
  const reasonLabel = filterReason ? (filterReason.length>14 ? filterReason.slice(0,14)+'…' : filterReason) : 'Lý do trả';
  const pageFrom = total===0?0:(page-1)*limit+1;
  const pageTo   = Math.min(page*limit,total);

  const kpiCards = [
    { label:'Phiếu trả hôm nay', value:stats?.todayCount??0,         gradient:'from-slate-600 to-slate-800',     isMoney:false },
    { label:'Tiền hoàn hôm nay', value:stats?.todayRefund??0,         gradient:'from-red-500 to-red-700',         isMoney:true  },
    { label:'Chờ duyệt',         value:stats?.pending??0,             gradient:'from-amber-500 to-amber-700',     isMoney:false },
    { label:'Đã duyệt tháng này',value:stats?.approvedThisMonth??0,   gradient:'from-emerald-500 to-emerald-700', isMoney:false,
      delta: stats?.approvedDelta },
    { label:'Tỷ lệ trả tháng này',value:stats?.returnRateThisMonth??0,gradient:'from-blue-500 to-blue-700',       isMoney:false, suffix:'%',
      delta: stats?.rateDelta, deltaUnit:'%' },
  ];

  // ── Column settings modal ─────────────────────────────────────────────────
  function ColSettingsModal() {
    const [draft, setDraft] = useState(new Set(visibleCols));
    const [colQ, setColQ] = useState('');
    function toggle(key:string){setDraft(prev=>{const n=new Set(prev);n.has(key)?n.delete(key):n.add(key);return n;});}
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={()=>setShowColSettings(false)}/>
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-gray-800">Tùy chỉnh cột hiển thị</h3>
              <p className="text-xs text-gray-400 mt-0.5">Đang hiển thị {draft.size} cột</p>
            </div>
            <button onClick={()=>setShowColSettings(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex flex-1 overflow-hidden">
            {/* Left */}
            <div className="w-1/2 border-r border-gray-100 overflow-y-auto p-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Tất cả các cột</p>
              <div className="relative mb-3">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input value={colQ} onChange={e=>setColQ(e.target.value)} placeholder="Tìm cột..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"/>
              </div>
              {COL_GROUPS.map(g=>{
                const cols=g.cols.filter(c=>c.label.toLowerCase().includes(colQ.toLowerCase()));
                if(!cols.length)return null;
                return(
                  <div key={g.group} className="mb-4">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{g.group}</p>
                    {cols.map(col=>{
                      const req=REQUIRED_COLS.has(col.key);
                      return(
                        <label key={col.key} className={`flex items-center gap-2.5 text-sm py-1.5 px-2 rounded-lg cursor-pointer transition ${req?'opacity-50 cursor-not-allowed':draft.has(col.key)?'bg-blue-50 text-blue-700':'text-gray-700 hover:bg-gray-50'}`}>
                          <input type="checkbox" checked={draft.has(col.key)} disabled={req}
                            onChange={()=>toggle(col.key)}
                            className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0"/>
                          <span className="flex-1">{col.label}</span>
                          {req&&<span className="text-[10px] text-gray-400">Bắt buộc</span>}
                        </label>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {/* Right */}
            <div className="w-1/2 overflow-y-auto p-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Đang hiển thị ({draft.size} cột)</p>
              <div className="space-y-1">
                {ALL_COLS.filter(c=>draft.has(c.key)).map(col=>{
                  const req=REQUIRED_COLS.has(col.key);
                  return(
                    <div key={col.key} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                      <span className="text-gray-700">{col.label}</span>
                      {req?<span className="text-[10px] text-gray-400">Bắt buộc</span>
                        :<button onClick={()=>toggle(col.key)} className="text-gray-400 hover:text-red-500 transition">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>}
                    </div>
                  );
                })}
                {draft.size===REQUIRED_COLS.size&&<p className="text-xs text-gray-400 italic text-center py-4">Chưa chọn cột nào thêm</p>}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <button onClick={()=>setDraft(new Set(DEFAULT_COLS))} className="text-sm text-gray-400 hover:text-gray-600">Về mặc định</button>
            <div className="flex gap-2">
              <button onClick={()=>setShowColSettings(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 border border-gray-200 rounded-xl">Thoát</button>
              <button onClick={()=>saveColSettings(draft)} className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700">Lưu</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-7 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-gray-900">Trả Hàng</h1>
          <p className="text-gray-400 text-xs mt-0.5">Quản lý phiếu trả hàng và hoàn tiền khách</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition disabled:opacity-50">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            {exporting ? 'Đang xuất...' : 'Xuất file'}
          </button>
          <Link href="/dashboard/returns/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-sm shadow-blue-200">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
            </svg>
            Tạo phiếu trả
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
        {/* KPI */}
        <div className="grid grid-cols-5 gap-2.5">
          {kpiCards.map(k=>(
            <div key={k.label} className={"bg-white rounded-lg border border-gray-100 shadow-sm flex items-center gap-2.5 px-3 py-2"}>
              <div className="flex items-start justify-between gap-1">
                <p className="text-[11px] text-white/70 font-medium leading-tight">{k.label}</p>
                {(k as {delta?:number}).delta !== undefined && (k as {delta?:number}).delta !== 0 && (
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0 ${(k as {delta?:number}).delta! > 0 ? 'bg-white/20 text-white' : 'bg-black/20 text-white/80'}`}>
                    {(k as {delta?:number}).delta! > 0 ? '↑' : '↓'}{Math.abs((k as {delta?:number}).delta!)}{(k as {deltaUnit?:string}).deltaUnit??''}
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-white mt-1">{k.isMoney?fmt(k.value)+'đ':k.value}{k.suffix??''}</p>
              <div className="absolute -right-2 -bottom-2 w-10 h-10 rounded-full bg-white/10"/>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>handleTab(t.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                t.key==='__analytics__'
                  ? tab==='__analytics__' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-purple-600'
                  : tab===t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.key==='__analytics__' && (
                <svg className="inline w-3.5 h-3.5 mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              )}
              {t.label}
            </button>
          ))}
        </div>

        {/* Analytics panel — chỉ hiện khi tab Phân tích */}
        {tab==='__analytics__' && stats && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
                Lý do trả hàng
                <span className="ml-1.5 font-normal text-gray-300 normal-case">(tháng này)</span>
              </h3>
              {stats.topReasons.length === 0 ? (
                <p className="text-sm text-gray-300 text-center py-6">Chưa có dữ liệu tháng này</p>
              ) : stats.topReasons.map((r,i)=>(
                <div key={i} className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 truncate max-w-[70%]">{r.reason}</span>
                    <span className="text-gray-400 font-medium">{r.count} phiếu · {r.percent}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full transition-all" style={{width:`${r.percent}%`}}/>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
                SP trả nhiều nhất
                <span className="ml-1.5 font-normal text-gray-300 normal-case">(tháng này)</span>
              </h3>
              {stats.topProducts.length === 0 ? (
                <p className="text-sm text-gray-300 text-center py-6">Chưa có dữ liệu tháng này</p>
              ) : stats.topProducts.map((p,i)=>{
                const colors=['bg-red-400','bg-orange-400','bg-amber-400','bg-emerald-400','bg-blue-400'];
                return(
                  <div key={i} className="flex items-center gap-3 mb-3">
                    <div className={`w-6 h-6 rounded-full ${colors[i]??'bg-gray-300'} flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0`}>{i+1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{p.productName}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{p.productCode}</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-500">{p.totalQty} lần</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Toolbar + Table — ẩn khi đang xem tab Phân tích */}
        {tab !== '__analytics__' && <>
        <div className="flex flex-wrap items-center gap-2">
          {/* Gear */}
          <button onClick={()=>setShowColSettings(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            Chọn cột
            <span className="text-[11px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded-full">{visibleCols.size}</span>
          </button>

          {/* Search */}
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input value={search} onChange={e=>handleSearch(e.target.value)}
              placeholder="Tìm mã phiếu, tên khách, đơn gốc..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"/>
          </div>

          {/* Date filter dropdown */}
          <div ref={dateDrop} className="relative">
            <button onClick={()=>setShowDateDrop(v=>!v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border transition whitespace-nowrap ${
                filterDatePreset?'bg-blue-50 border-blue-300 text-blue-700 font-semibold':'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {dateLabel}
              {filterDatePreset&&<span className="w-1.5 h-1.5 rounded-full bg-blue-500"/>}
              <svg className={`w-3 h-3 transition-transform ${showDateDrop?'rotate-180':''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            {showDateDrop&&(
              <div className="absolute top-full left-0 mt-1.5 z-40 bg-white border border-gray-200 rounded-2xl shadow-xl w-64 p-2">
                <div className="grid grid-cols-2 gap-1 mb-2">
                  {DATE_PRESETS.filter(p=>p.key!=='custom').map(p=>(
                    <button key={p.key} onClick={()=>applyDatePreset(p.key)}
                      className={`px-3 py-2 text-xs rounded-xl text-center transition ${filterDatePreset===p.key?'bg-blue-600 text-white font-semibold':'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-2">
                  <p className="text-[10px] text-gray-400 mb-1.5 px-1">Tuỳ chọn khoảng ngày</p>
                  <div className="flex gap-1 mb-2">
                    <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"/>
                    <span className="text-gray-300 self-center">—</span>
                    <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"/>
                  </div>
                  <div className="flex gap-1">
                    {filterDatePreset&&<button onClick={clearDate} className="flex-1 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Xoá</button>}
                    <button onClick={applyCustomDate} disabled={!customFrom&&!customTo}
                      className="flex-1 py-1.5 text-xs bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 font-semibold">Lọc</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Refund method dropdown */}
          <FilterDropdown label={refundLabel} active={!!filterRefund}>
            <div className="p-2 space-y-0.5">
              {[{k:'',v:'Tất cả PT hoàn'},...Object.entries(REFUND_LABEL).map(([k,v])=>({k,v}))].map(({k,v})=>(
                <button key={k} onClick={()=>applyRefund(k)}
                  className={`w-full text-left px-3 py-2 text-xs rounded-xl transition ${filterRefund===k?'bg-blue-50 text-blue-700 font-semibold':'text-gray-600 hover:bg-gray-50'}`}>
                  {v}
                </button>
              ))}
            </div>
          </FilterDropdown>

          {/* Reason dropdown */}
          <FilterDropdown label={reasonLabel} active={!!filterReason}>
            <div className="p-2 space-y-0.5">
              <button onClick={()=>applyReason('')}
                className={`w-full text-left px-3 py-2 text-xs rounded-xl transition ${!filterReason?'bg-blue-50 text-blue-700 font-semibold':'text-gray-600 hover:bg-gray-50'}`}>
                Tất cả lý do
              </button>
              {REASONS.map(r=>(
                <button key={r} onClick={()=>applyReason(r)}
                  className={`w-full text-left px-3 py-2 text-xs rounded-xl transition ${filterReason===r?'bg-blue-50 text-blue-700 font-semibold':'text-gray-600 hover:bg-gray-50'}`}>
                  {r}
                </button>
              ))}
            </div>
          </FilterDropdown>

          {/* Clear all filters */}
          {(filterDatePreset||filterRefund||filterReason)&&(
            <button onClick={()=>{clearDate();applyRefund('');applyReason('');}}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl border border-red-200 transition">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              Xoá lọc
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {has('code')          &&<th onClick={()=>handleSort('code')} className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none">
                    Mã phiếu<SortIcon col="code" sortBy={sortBy} sortOrder={sortOrder}/>
                  </th>}
                  {has('createdAt')     &&<th onClick={()=>handleSort('createdAt')} className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none">
                    Ngày tạo<SortIcon col="createdAt" sortBy={sortBy} sortOrder={sortOrder}/>
                  </th>}
                  {has('updatedAt')     &&<th onClick={()=>handleSort('updatedAt')} className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none">
                    Cập nhật<SortIcon col="updatedAt" sortBy={sortBy} sortOrder={sortOrder}/>
                  </th>}
                  {has('order')         &&<th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Đơn gốc</th>}
                  {has('customer')      &&<th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Khách hàng</th>}
                  {has('customerPhone') &&<th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">SĐT</th>}
                  {has('items')         &&<th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Sản phẩm</th>}
                  {has('reason')        &&<th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Lý do trả</th>}
                  {has('totalRefund')   &&<th onClick={()=>handleSort('totalRefund')} className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none">
                    Tiền hoàn<SortIcon col="totalRefund" sortBy={sortBy} sortOrder={sortOrder}/>
                  </th>}
                  {has('refundMethod')  &&<th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">PT hoàn</th>}
                  {has('status')        &&<th onClick={()=>handleSort('status')} className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none">
                    Trạng thái<SortIcon col="status" sortBy={sortBy} sortOrder={sortOrder}/>
                  </th>}
                  {has('processedBy')   &&<th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Người XL</th>}
                  {has('processedAt')   &&<th onClick={()=>handleSort('processedAt')} className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none">
                    Ngày XL<SortIcon col="processedAt" sortBy={sortBy} sortOrder={sortOrder}/>
                  </th>}
                  {has('rejectReason')  &&<th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Lý do từ chối</th>}
                  {has('notes')         &&<th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Ghi chú</th>}
                  <th className="w-10"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading?(
                  <tr><td colSpan={20} className="px-5 py-12 text-center text-gray-400">Đang tải...</td></tr>
                ):records.length===0?(
                  <tr><td colSpan={20} className="px-5 py-12 text-center">
                    {loadError
                      ? <div className="text-red-500 text-sm">⚠ {loadError} — <button onClick={() => load()} className="underline hover:text-red-700">Thử lại</button></div>
                      : <span className="text-gray-400">Không có phiếu trả hàng nào</span>
                    }
                  </td></tr>
                ):records.map(r=>{
                  const fi=r.items[0]; const mi=r.items.length-1;
                  return(
                    <tr key={r.id} onClick={()=>router.push(`/dashboard/returns/${r.id}`)}
                      className="cursor-pointer hover:bg-blue-50/30 transition-colors">
                      {has('code')          &&<td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">{r.code}</td>}
                      {has('createdAt')     &&<td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(r.createdAt)}</td>}
                      {has('updatedAt')     &&<td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(r.updatedAt)}</td>}
                      {has('order')         &&<td className="px-4 py-3">{r.order?<span className="font-mono text-xs text-blue-600">{r.order.code}</span>:<span className="text-gray-300">—</span>}</td>}
                      {has('customer')      &&<td className="px-4 py-3 text-gray-700 text-xs">{r.customer?.name??'—'}</td>}
                      {has('customerPhone') &&<td className="px-4 py-3 text-gray-500 text-xs">{r.customer?.phone??'—'}</td>}
                      {has('items')         &&<td className="px-4 py-3 text-xs text-gray-600">{fi?<>{fi.productName}{mi>0&&<span className="text-gray-400 ml-1">+{mi}</span>}</>:<span className="text-gray-300">—</span>}</td>}
                      {has('reason')        &&<td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{r.reason??'—'}</td>}
                      {has('totalRefund')   &&<td className="px-4 py-3 font-semibold text-red-600 text-xs whitespace-nowrap">{fmt(r.totalRefund)}đ</td>}
                      {has('refundMethod')  &&<td className="px-4 py-3 text-gray-500 text-xs">{REFUND_LABEL[r.refundMethod]??r.refundMethod}</td>}
                      {has('status')        &&<td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[r.status]??''}`}>{STATUS_LABEL[r.status]??r.status}</span></td>}
                      {has('processedBy')   &&<td className="px-4 py-3 text-gray-500 text-xs">{r.processedBy?.fullName??r.processedBy?.username??'—'}</td>}
                      {has('processedAt')   &&<td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{r.processedAt?fmtDate(r.processedAt):'—'}</td>}
                      {has('rejectReason')  &&<td className="px-4 py-3 text-xs text-red-400 max-w-[160px] truncate">{r.rejectReason??'—'}</td>}
                      {has('notes')         &&<td className="px-4 py-3 text-gray-400 text-xs max-w-[160px] truncate">{r.notes??'—'}</td>}
                      <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>
                        {r.status==='pending'&&<Link href={`/dashboard/returns/${r.id}`} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Duyệt</Link>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination — giống Orders */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>Hiển thị</span>
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                  {([20,50,100] as const).map(n=>(
                    <button key={n} onClick={()=>handleLimit(n)}
                      className={`px-2.5 py-1 text-xs font-medium transition border-r border-gray-200 last:border-r-0 ${limit===n?'bg-blue-600 text-white':'text-gray-500 hover:bg-gray-50'}`}>
                      {n}
                    </button>
                  ))}
                </div>
                <span>kết quả</span>
              </div>
              <span className="text-gray-200">·</span>
              <span className="text-xs text-gray-400">
                {total===0?'0':`${pageFrom}–${pageTo}`} trên tổng <span className="font-semibold text-gray-600">{total}</span> phiếu
              </span>
            </div>

            {totalPages>1&&(
              <div className="flex items-center gap-1">
                <button onClick={()=>handlePage(1)} disabled={page===1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs font-medium" title="Trang đầu">«</button>
                <button onClick={()=>handlePage(page-1)} disabled={page===1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs" title="Trang trước">‹</button>

                {Array.from({length:totalPages},(_,i)=>i+1)
                  .filter(p=>p===1||p===totalPages||Math.abs(p-page)<=1)
                  .reduce<(number|'e')[]>((acc,p,idx,arr)=>{
                    if(idx>0&&p-(arr[idx-1] as number)>1)acc.push('e');
                    acc.push(p);return acc;
                  },[])
                  .map((item,idx)=>
                    item==='e'
                      ?<span key={`e${idx}`} className="w-7 h-7 flex items-center justify-center text-gray-300 text-xs">…</span>
                      :<button key={item} onClick={()=>handlePage(item as number)}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition ${page===item?'bg-blue-600 text-white shadow-sm':'text-gray-500 hover:bg-gray-100'}`}>
                          {item}
                        </button>
                  )}

                <button onClick={()=>handlePage(page+1)} disabled={page===totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs" title="Trang sau">›</button>
                <button onClick={()=>handlePage(totalPages)} disabled={page===totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs font-medium" title="Trang cuối">»</button>
              </div>
            )}
          </div>
        </div>
        </>}
      </div>

      {showColSettings&&<ColSettingsModal/>}
    </div>
  );
}
